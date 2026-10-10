'use strict';
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT || 3000);
const dbPath = path.resolve(process.env.DB_PATH || path.join(__dirname, 'data', 'restaurant.sqlite'));
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
 CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY CHECK(id=1), phone TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, phone TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data_json TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone, created_at DESC);
 CREATE TABLE IF NOT EXISTS restaurant_reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL UNIQUE, customer_name TEXT NOT NULL, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), text TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(order_id) REFERENCES orders(id));
 CREATE INDEX IF NOT EXISTS idx_reviews_created ON restaurant_reviews(created_at DESC);
 CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions (sid TEXT PRIMARY KEY, sess TEXT NOT NULL, expire INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);
`);

class SQLiteSessionStore extends session.Store {
  get(sid, cb) { try { const row=db.prepare('SELECT sess,expire FROM sessions WHERE sid=?').get(sid); if(!row||row.expire<Date.now()){if(row)db.prepare('DELETE FROM sessions WHERE sid=?').run(sid);return cb(null,null)} cb(null,JSON.parse(row.sess)); } catch(e){cb(e)} }
  set(sid, sess, cb=()=>{}) { try { const expire=sess.cookie?.expires ? new Date(sess.cookie.expires).getTime() : Date.now()+86400000; db.prepare('INSERT INTO sessions(sid,sess,expire) VALUES(?,?,?) ON CONFLICT(sid) DO UPDATE SET sess=excluded.sess,expire=excluded.expire').run(sid,JSON.stringify(sess),expire); cb(null); } catch(e){cb(e)} }
  destroy(sid, cb=()=>{}) { try {db.prepare('DELETE FROM sessions WHERE sid=?').run(sid);cb(null)}catch(e){cb(e)} }
  touch(sid, sess, cb=()=>{}) { this.set(sid,sess,cb); }
}

if (isProduction) app.set('trust proxy', 1);
if (isProduction && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length<32)) {
  console.error('FATAL: In production, SESSION_SECRET must be set to a random string of at least 32 characters.'); process.exit(1);
}
if (isProduction && (!process.env.BOOTSTRAP_SECRET || process.env.BOOTSTRAP_SECRET.length<24)) {
  console.error('FATAL: In production, BOOTSTRAP_SECRET must be set to a random secret of at least 24 characters.'); process.exit(1);
}
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use((req,res,next)=>{
  res.setHeader('Cache-Control','no-store');
  if (req.path.startsWith('/api/') && ['POST','PATCH','PUT','DELETE'].includes(req.method)) {
    const origin=req.get('origin');
    if (isProduction && !origin) return res.status(403).json({error:'Thiếu Origin; yêu cầu bị từ chối.'});
    if (origin) { try { if(new URL(origin).host!==req.get('host')) return res.status(403).json({error:'Yêu cầu khác nguồn bị từ chối.'}); } catch { return res.status(403).json({error:'Origin không hợp lệ.'}); } }
  }
  next();
});
app.use(express.json({limit:'1mb', strict:true}));
app.use(session({
  name: 'quan_ngon_admin_session', store: new SQLiteSessionStore(),
  secret: process.env.SESSION_SECRET || (isProduction ? '' : 'local-development-only-change-before-deploy-9a2b7f4e'),
  resave:false, saveUninitialized:false, rolling:true,
  cookie:{ httpOnly:true, secure:isProduction, sameSite:'strict', maxAge: 8*60*60*1000, path:'/' }
}));
const loginLimiter=rateLimit({windowMs:15*60*1000,limit:8,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Quá nhiều lần thử. Vui lòng đợi 15 phút rồi thử lại.'}});
const setupLimiter=rateLimit({windowMs:60*60*1000,limit:4,standardHeaders:'draft-8',legacyHeaders:false});
// Customer order tracking: avoid a low IP-wide limiter that blocks multiple customers
// behind the same Wi-Fi/mobile carrier. Keep a generous safety ceiling per IP.
const trackingLimiter=rateLimit({windowMs:15*60*1000,limit:300,standardHeaders:'draft-8',legacyHeaders:false, message:{error:'Bạn đã tra cứu quá nhiều lần. Vui lòng thử lại sau ít phút.'}});
const adminOnly=(req,res,next)=>req.session?.adminId===1?next():res.status(401).json({error:'Vui lòng đăng nhập Admin.'});
const normalizePhone=v=>String(v||'').replace(/[\s().-]/g,'').slice(0,24);
const statuses=['Mới','Đã xác nhận','Đang chuẩn bị','Sẵn sàng','Đang giao','Hoàn thành','Đã hủy'];
const getAdmin=()=>db.prepare('SELECT id,phone,password_hash FROM admins WHERE id=1').get();
const makeOrderId=()=>{const d=new Date();return `QN-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`};
function cleanOrder(input){
  if(!input||typeof input!=='object')throw new Error('Dữ liệu đơn hàng không hợp lệ.');
  const customerName=String(input.customerName||'').trim().slice(0,80), phone=normalizePhone(input.phone), fulfillment=input.fulfillment==='pickup'?'pickup':'delivery';
  if(customerName.length<2)throw new Error('Vui lòng nhập họ tên hợp lệ.');
  if(phone.replace(/\D/g,'').length<9)throw new Error('Số điện thoại không hợp lệ.');
  if(fulfillment==='delivery'&&!String(input.address||'').trim())throw new Error('Thiếu địa chỉ giao hàng.');
  if(!Array.isArray(input.items)||input.items.length<1||input.items.length>50)throw new Error('Danh sách món ăn không hợp lệ.');
  const items=input.items.map(it=>{const qty=Math.floor(Number(it.qty));const price=Math.round(Number(it.price));if(!Number.isInteger(qty)||qty<1||qty>99||!Number.isFinite(price)||price<0||price>100000000)throw new Error('Số lượng hoặc giá món không hợp lệ.');return {foodId:String(it.foodId||'').slice(0,100),name:String(it.name||'Món ăn').slice(0,100),qty,price,note:String(it.note||'').slice(0,300),...(it.size?{size:String(it.size).slice(0,40)}:{}),...(Array.isArray(it.toppings)?{toppings:it.toppings.slice(0,20)}:{})}});
  const subtotal=items.reduce((sum,it)=>sum+it.qty*it.price,0); if(subtotal>500000000)throw new Error('Giá trị đơn hàng vượt giới hạn.');
  const deliveryFee=Math.max(0,Math.min(1000000,Math.round(Number(input.deliveryFee)||0)));
  const discount=Math.max(0,Math.min(subtotal+deliveryFee,Math.round(Number(input.discount)||0)));
  const total=Math.max(0,subtotal+deliveryFee-discount); const now=new Date().toISOString();
  return {id:makeOrderId(),createdAt:now,updatedAt:now,customerName,phone,address:fulfillment==='pickup'?'Nhận tại quán':String(input.address||'').trim().slice(0,300),fulfillment,table:String(input.table||'').slice(0,20),receiveTime:String(input.receiveTime||'Ngay khi có thể').slice(0,50),payment:['Tiền mặt khi nhận món','Chuyển khoản ngân hàng','Thanh toán tại quán'].includes(input.payment)?input.payment:'Tiền mặt khi nhận món',note:String(input.note||'').slice(0,500),items,subtotal,deliveryFee,discount,total,coupon:String(input.coupon||'').slice(0,40),status:'Mới',statusHistory:[{status:'Mới',at:now}]};
}
app.get('/api/health',(req,res)=>{try{db.prepare('SELECT 1').get();res.status(200).json({ok:true,service:'quan-ngon-api',database:'ok',time:new Date().toISOString()})}catch(e){console.error('Health check database error:',e.message);res.status(503).json({ok:false,service:'quan-ngon-api',database:'error',error:'Cơ sở dữ liệu hiện không sẵn sàng.'})}});
const defaultRestaurantSettings={name:'QUÁN NGON',phone:'',address:'',hours:'08:00 – 22:00',deliveryFee:15000,minimumOrder:0,acceptingOrders:true,soundEnabled:true,bankTransferEnabled:false,bankCode:'VCB',bankAccount:'',bankAccountName:'',bankQrImage:'',tableCount:20};
function readRestaurantSettings(){const rows=db.prepare('SELECT key,value_json FROM app_settings').all();const out={...defaultRestaurantSettings};for(const row of rows){try{out[row.key]=JSON.parse(row.value_json)}catch{}}return out}
function writeRestaurantSettings(input){const current=readRestaurantSettings();const allowed=['name','phone','address','hours','deliveryFee','minimumOrder','acceptingOrders','soundEnabled','bankTransferEnabled','bankCode','bankAccount','bankAccountName','bankQrImage','tableCount'];const next={...current};for(const key of allowed)if(Object.prototype.hasOwnProperty.call(input,key))next[key]=input[key];next.tableCount=Math.max(1,Math.min(200,Math.floor(Number(next.tableCount)||20)));next.deliveryFee=Math.max(0,Math.min(1000000,Math.round(Number(next.deliveryFee)||0)));next.minimumOrder=Math.max(0,Math.min(100000000,Math.round(Number(next.minimumOrder)||0)));next.name=String(next.name||'QUÁN NGON').trim().slice(0,100);next.phone=String(next.phone||'').trim().slice(0,30);next.address=String(next.address||'').trim().slice(0,300);next.hours=String(next.hours||'').trim().slice(0,100);next.bankAccount=String(next.bankAccount||'').trim().slice(0,40);next.bankAccountName=String(next.bankAccountName||'').trim().slice(0,100);next.bankQrImage=String(next.bankQrImage||'').slice(0,950000);const now=new Date().toISOString();const put=db.prepare('INSERT INTO app_settings(key,value_json,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at');const tx=db.transaction(()=>{for(const key of allowed)put.run(key,JSON.stringify(next[key]),now)});tx();return next}
app.get('/api/settings',(req,res)=>res.json({settings:readRestaurantSettings()}));
app.patch('/api/admin/settings',adminOnly,(req,res)=>{try{const input=req.body||{};if(input.tableCount!==undefined&&(!Number.isInteger(Number(input.tableCount))||Number(input.tableCount)<1||Number(input.tableCount)>200))return res.status(400).json({error:'Số bàn phải từ 1 đến 200.'});if(input.bankTransferEnabled&&(!String(input.bankAccount||'').trim()||!String(input.bankAccountName||'').trim()))return res.status(400).json({error:'Nhập số tài khoản và tên chủ tài khoản để bật chuyển khoản.'});const settings=writeRestaurantSettings(input);res.json({ok:true,settings})}catch(e){console.error('Save settings error:',e.message);res.status(500).json({error:'Không thể lưu cài đặt lên máy chủ.'})}});
app.get('/api/admin/status',(req,res)=>res.json({setupRequired:!getAdmin()}));
app.get('/api/admin/me',(req,res)=>{if(req.session?.adminId!==1)return res.json({authenticated:false});const a=getAdmin();res.json({authenticated:!!a,phone:a?.phone||''})});
app.post('/api/admin/setup',setupLimiter,async(req,res)=>{
  if(getAdmin())return res.status(409).json({error:'Tài khoản Admin đã được tạo.'});
  const secret=String(req.body?.bootstrapSecret||''),expected=String(process.env.BOOTSTRAP_SECRET||'');
  if(!expected||secret.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(secret),Buffer.from(expected)))return res.status(403).json({error:'Mã khởi tạo không đúng. Kiểm tra cấu hình máy chủ.'});
  const phone=normalizePhone(req.body?.phone),password=String(req.body?.password||'');
  if(phone.replace(/\D/g,'').length<9||password.length<12)return res.status(400).json({error:'Số điện thoại hoặc mật khẩu chưa đạt yêu cầu (mật khẩu tối thiểu 12 ký tự).'});
  try{const hash=await bcrypt.hash(password,12);const now=new Date().toISOString();db.prepare('INSERT INTO admins(id,phone,password_hash,created_at,updated_at) VALUES(1,?,?,?,?)').run(phone,hash,now,now);req.session.adminId=1;req.session.regenerate(err=>{if(err)return res.status(500).json({error:'Không thể tạo phiên đăng nhập.'});req.session.adminId=1;req.session.save(e=>e?res.status(500).json({error:'Không thể lưu phiên đăng nhập.'}):res.json({ok:true}));});}catch(e){res.status(500).json({error:'Không thể tạo tài khoản Admin.'})}
});
app.post('/api/admin/login',loginLimiter,async(req,res)=>{
  const phone=normalizePhone(req.body?.phone),password=String(req.body?.password||''),admin=getAdmin();
  if(!admin||!phone||!password)return res.status(401).json({error:'Sai số điện thoại hoặc mật khẩu.'});
  const ok=await bcrypt.compare(password,admin.password_hash).catch(()=>false);if(!ok||phone!==admin.phone)return res.status(401).json({error:'Sai số điện thoại hoặc mật khẩu.'});
  req.session.regenerate(err=>{if(err)return res.status(500).json({error:'Không thể tạo phiên đăng nhập.'});req.session.adminId=1;req.session.save(e=>e?res.status(500).json({error:'Không thể lưu phiên đăng nhập.'}):res.json({ok:true,phone:admin.phone}));});
});
app.post('/api/admin/logout',adminOnly,(req,res)=>req.session.destroy(()=>{res.clearCookie('quan_ngon_admin_session',{path:'/'});res.json({ok:true})}));
app.patch('/api/admin/credentials',adminOnly,loginLimiter,async(req,res)=>{
  const a=getAdmin(),currentPassword=String(req.body?.currentPassword||''),newPhone=normalizePhone(req.body?.newPhone),newPassword=String(req.body?.newPassword||'');
  if(!a||!await bcrypt.compare(currentPassword,a.password_hash).catch(()=>false))return res.status(401).json({error:'Mật khẩu hiện tại không đúng.'});
  if(newPhone.replace(/\D/g,'').length<9)return res.status(400).json({error:'Số điện thoại mới không hợp lệ.'});
  if(newPassword&&newPassword.length<12)return res.status(400).json({error:'Mật khẩu mới phải có ít nhất 12 ký tự.'});
  try{const hash=newPassword?await bcrypt.hash(newPassword,12):a.password_hash;db.prepare('UPDATE admins SET phone=?,password_hash=?,updated_at=? WHERE id=1').run(newPhone,hash,new Date().toISOString());req.session.regenerate(err=>{if(err)return res.status(500).json({error:'Không thể làm mới phiên đăng nhập.'});req.session.adminId=1;req.session.save(e=>e?res.status(500).json({error:'Không thể lưu phiên.'}):res.json({ok:true,phone:newPhone}));});}catch(e){res.status(409).json({error:'Số điện thoại này có thể đã được sử dụng.'})}
});
app.get('/api/admin/orders',adminOnly,(req,res)=>{const rows=db.prepare('SELECT data_json FROM orders ORDER BY created_at DESC LIMIT 2000').all();res.json({orders:rows.map(r=>JSON.parse(r.data_json))})});
app.get('/api/admin/reviews',adminOnly,(req,res)=>{const reviews=db.prepare('SELECT id,order_id AS orderId,customer_name AS customerName,rating,text,created_at AS createdAt FROM restaurant_reviews ORDER BY created_at DESC LIMIT 2000').all();res.json({reviews})});
app.get('/api/reviews',(req,res)=>{const reviews=db.prepare('SELECT id,customer_name AS customerName,rating,text,created_at AS createdAt FROM restaurant_reviews ORDER BY created_at DESC LIMIT 100').all();res.json({reviews})});
app.post('/api/reviews',rateLimit({windowMs:15*60*1000,limit:20,standardHeaders:'draft-8',legacyHeaders:false}), (req,res)=>{
  const orderId=String(req.body?.orderId||'').trim().slice(0,80), text=String(req.body?.text||'').trim().slice(0,1000), rating=Number(req.body?.rating);
  if(!orderId||text.length<2||!Number.isInteger(rating)||rating<1||rating>5)return res.status(400).json({error:'Vui lòng nhập nội dung đánh giá và chọn từ 1 đến 5 sao.'});
  const row=db.prepare('SELECT data_json FROM orders WHERE id=?').get(orderId);if(!row)return res.status(404).json({error:'Không tìm thấy đơn hàng trên máy chủ.'});
  const order=JSON.parse(row.data_json);if(order.status!=='Hoàn thành')return res.status(400).json({error:'Chỉ đánh giá được đơn hàng đã hoàn thành.'});
  const existing=db.prepare('SELECT id FROM restaurant_reviews WHERE order_id=?').get(orderId);if(existing)return res.status(409).json({error:'Đơn hàng này đã được đánh giá.'});
  const createdAt=new Date().toISOString();try{const result=db.prepare('INSERT INTO restaurant_reviews(order_id,customer_name,rating,text,created_at) VALUES(?,?,?,?,?)').run(orderId,String(order.customerName||'Khách hàng').slice(0,80),rating,text,createdAt);res.status(201).json({review:{id:result.lastInsertRowid,orderId,customerName:String(order.customerName||'Khách hàng').slice(0,80),rating,text,createdAt}})}catch(e){if(String(e.code||'').includes('CONSTRAINT'))return res.status(409).json({error:'Đơn hàng này đã được đánh giá.'});res.status(500).json({error:'Không thể lưu đánh giá trên máy chủ.'})}
});
app.patch('/api/admin/orders/:id',adminOnly,(req,res)=>{
  const row=db.prepare('SELECT data_json FROM orders WHERE id=?').get(String(req.params.id));if(!row)return res.status(404).json({error:'Không tìm thấy đơn hàng.'});
  const status=String(req.body?.status||'');if(!statuses.includes(status))return res.status(400).json({error:'Trạng thái không hợp lệ.'});
  const order=JSON.parse(row.data_json);if(order.status!==status){order.status=status;order.updatedAt=new Date().toISOString();order.statusHistory=Array.isArray(order.statusHistory)?order.statusHistory:[];order.statusHistory.push({status,at:order.updatedAt});db.prepare('UPDATE orders SET status=?,updated_at=?,data_json=? WHERE id=?').run(status,order.updatedAt,JSON.stringify(order),order.id)}res.json({order});
});
app.post('/api/orders',rateLimit({windowMs:10*60*1000,limit:20,standardHeaders:'draft-8',legacyHeaders:false}), (req,res)=>{
  let order;
  try { order=cleanOrder(req.body); }
  catch(e) { return res.status(400).json({error:e.message||'Thông tin đơn hàng chưa hợp lệ.'}); }
  try {
    db.prepare('INSERT INTO orders(id,phone,status,created_at,updated_at,data_json) VALUES(?,?,?,?,?,?)').run(order.id,order.phone,order.status,order.createdAt,order.updatedAt,JSON.stringify(order));
    return res.status(201).json({order});
  } catch(e) {
    console.error('Create order database error:',e.message);
    if (String(e.code||'').includes('CONSTRAINT')) return res.status(409).json({error:'Đơn hàng bị trùng mã. Vui lòng gửi lại đơn.'});
    return res.status(500).json({error:'Máy chủ chưa lưu được đơn hàng. Vui lòng thử lại sau; không thanh toán lại nếu chưa xác nhận đơn.'});
  }
});
app.get('/api/orders',trackingLimiter,(req,res)=>{
  // Không tra cứu đơn công khai bằng số điện thoại vì không chứng minh được quyền sở hữu.
  res.status(410).json({error:'Tra cứu đơn bằng số điện thoại đã được tắt để bảo vệ thông tin khách hàng.'});
});

app.use((req,res,next)=>{const pth=decodeURIComponent(req.path||'/');if(['/server.js','/package.json','/package-lock.json','/README.md','/.env.example','/.gitignore'].includes(pth)||pth.startsWith('/data/')||pth.startsWith('/node_modules/')||pth.startsWith('/.git/'))return res.status(404).end();next()});
app.use(express.static(__dirname,{extensions:['html'],dotfiles:'deny',index:'index.html'}));
app.use((err,req,res,next)=>{console.error('Request error:',err.message);if(res.headersSent)return next(err);res.status(400).json({error:'Yêu cầu không hợp lệ.'})});
// Local Windows machines may still have an older Quán Ngon server (or another app)
// on port 3000. In development, automatically try the next ports and print the
// exact URL to open. On hosting, keep the platform-provided PORT strict.
function startHttpServer(candidatePort, attempt=0) {
  const server = app.listen(candidatePort, '0.0.0.0', () => {
    console.log('');
    console.log('==========================================');
    console.log(' QUAN NGON - MAY CHU DA KHOI DONG');
    console.log('==========================================');
    console.log(`Website:      http://localhost:${candidatePort}`);
    console.log(`Health check: http://localhost:${candidatePort}/api/health`);
    console.log(`API orders:   http://localhost:${candidatePort}/api/orders`);
    console.log('Hay mo dung URL Website o tren (khong dung URL cua server cu).');
    console.log('Nhan Ctrl+C de dung may chu.');
    console.log('');
  });
  server.on('error', err => {
    const canFallback = !isProduction && err.code === 'EADDRINUSE' && attempt < 20;
    if (canFallback) {
      console.warn(`[CANH BAO] Cong ${candidatePort} dang duoc su dung; thu cong ${candidatePort + 1}...`);
      startHttpServer(candidatePort + 1, attempt + 1);
      return;
    }
    if (err.code === 'EADDRINUSE') console.error(`FATAL: Port ${candidatePort} dang duoc su dung. Hay dung tien trinh cu hoac kiem tra bien PORT.`);
    else console.error('FATAL: Khong the khoi dong HTTP server:', err.message);
    process.exitCode = 1;
  });
}
startHttpServer(port);

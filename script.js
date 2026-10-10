/* QUÁN NGON — giao diện khách/Admin. Đơn hàng đồng bộ qua API; dữ liệu phụ trợ vẫn có thể lưu cục bộ. */
(() => {
'use strict';
const KEYS = {
 foods:'restaurant_foods', orders:'restaurant_orders', categories:'restaurant_categories',
 toppings:'restaurant_toppings', sizes:'restaurant_sizes', coupons:'restaurant_coupons',
 tables:'restaurant_tables', reviews:'restaurant_reviews', favorites:'restaurant_favorites',
 settings:'restaurant_settings', notifications:'restaurant_notifications', theme:'restaurant_theme',
 session:'restaurant_admin_session'
};
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const money = n => new Intl.NumberFormat('vi-VN').format(Math.max(0, Math.round(Number(n)||0)))+'đ';
const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Math.random().toString(36).slice(2,8).toUpperCase();
const nowISO = () => new Date().toISOString();
const dateLabel = value => { const d=new Date(value); return Number.isNaN(d.getTime())?'—':d.toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); };
const fallbackImage = 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=700&q=80';
const img = (src, alt='Món ăn') => `<img src="${safe(src||fallbackImage)}" alt="${safe(alt)}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackImage}'">`;
function loadData(key, fallback) {
  try { const raw=localStorage.getItem(key); if(raw===null) return fallback; const parsed=JSON.parse(raw); return parsed ?? fallback; }
  catch(e) { console.warn('Dữ liệu không đọc được:',key); return fallback; }
}
function saveData(key, value) {
  try { localStorage.setItem(key,JSON.stringify(value)); notifySync(key); return true; }
  catch(e) { toast('Không thể lưu dữ liệu. Ảnh có thể quá lớn, hãy dùng ảnh nhỏ hơn.','error'); return false; }
}
let channel=null;
let bankQrImage='';
try { if ('BroadcastChannel' in window) { channel=new BroadcastChannel('restaurant_sync'); channel.onmessage=(event)=>{ const page=document.body.dataset.page; if(page==='customer')renderCustomer(); else if(page==='admin')renderAdmin(); if(event.data?.key===KEYS.orders)checkNewOrderAlerts(); }; } } catch(e) {}
function notifySync(key) { try { if(channel) channel.postMessage({key,at:Date.now()}); } catch(e) {} }
window.addEventListener('storage', e => { if(e.key && e.key.startsWith('restaurant_')) { const page=document.body.dataset.page; if(page==='customer')renderCustomer(); else if(page==='admin')renderAdmin(); if(e.key===KEYS.orders)checkNewOrderAlerts(); } });
function toast(message,type='success') {
  const region=$('#toastRegion'); if(!region) return;
  const el=document.createElement('div'); el.className='toast '+(type==='error'?'error':type==='warning'?'warning':''); el.textContent=message; region.appendChild(el);
  setTimeout(()=>{el.style.opacity='0';el.style.transform='translateX(10px)';setTimeout(()=>el.remove(),250)},3300);
}
function setTheme(theme) { document.documentElement.dataset.theme=theme; try{localStorage.setItem(KEYS.theme,theme)}catch(e){} }
function initTheme() { setTheme(loadData(KEYS.theme,'light')); }
function toggleTheme() { setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'); }
const defaultCategories=['Cơm','Phở','Bún','Mì','Món nước','Món nướng','Gà','Thịt','Hải sản','Đồ ăn nhanh','Pizza','Burger','Đồ chay','Đồ uống','Trà','Cà phê','Nước ngọt','Tráng miệng'];
const photo={
 'Cơm':'photo-1512058564366-18510be2db19','Phở':'photo-1582878826629-29b7ad1cdc43','Bún':'photo-1555126634-323283e090fa','Mì':'photo-1569718212165-3a8278d5f624','Gà':'photo- chicken','Hải sản':'photo-1559737558-2f5a35f4523b','Đồ ăn nhanh':'photo-1568901346375-23c9450c58cd','Pizza':'photo-1513104890138-7c749659a591','Đồ uống':'photo-1544145945-f90425340c7e','Tráng miệng':'photo-1488477181946-6428a0291777'
};
const seedFoods = [
['Cơm tấm sườn','Cơm',55000,'Sườn nướng thơm, cơm tấm dẻo, ăn kèm đồ chua.','Gạo tấm, sườn heo, dưa chua',true],
['Cơm gà nướng','Cơm',65000,'Gà nướng vàng thơm dùng cùng cơm nóng.','Gà, gạo, rau xanh',true],
['Cơm gà xối mỡ','Cơm',62000,'Da gà giòn rụm, thịt mềm ngọt.','Gà, gạo, dưa leo',true],
['Cơm bò lúc lắc','Cơm',72000,'Thịt bò mềm đảo lửa lớn cùng rau củ.','Thịt bò, hành tây, ớt chuông',true],
['Cơm chiên Dương Châu','Cơm',48000,'Cơm chiên tơi cùng trứng và rau củ.','Cơm, trứng, tôm, rau củ',false],
['Cơm chiên hải sản','Cơm',59000,'Cơm chiên thơm với tôm và mực.','Cơm, tôm, mực',false],
['Cơm sườn trứng','Cơm',62000,'Sườn nướng, trứng ốp la và nước mắm nhà làm.','Sườn, trứng, cơm',false],
['Cơm cá kho','Cơm',58000,'Cá kho đậm đà ăn cùng cơm trắng.','Cá, nước màu, tiêu',false],
['Phở bò','Phở',55000,'Nước dùng thơm, bánh phở mềm và thịt bò.','Bánh phở, bò, hành',true],
['Phở bò tái','Phở',59000,'Phở bò tái mềm, nước dùng ninh kỹ.','Bánh phở, bò tái, hành',false],
['Phở bò viên','Phở',55000,'Bò viên dai ngon trong nước dùng nóng.','Bánh phở, bò viên',false],
['Phở gà','Phở',52000,'Thịt gà mềm, nước dùng thanh ngọt.','Bánh phở, gà, rau thơm',false],
['Phở đặc biệt','Phở',75000,'Tô phở đầy đặn với nhiều lựa chọn thịt bò.','Bánh phở, thịt bò, bò viên',true],
['Bún bò Huế','Bún',60000,'Vị cay thơm đặc trưng, nước dùng đậm vị.','Bún, bò, sả, rau sống',true],
['Bún chả','Bún',58000,'Thịt nướng thơm ăn cùng bún và nước chấm.','Bún, thịt heo, rau sống',true],
['Bún thịt nướng','Bún',55000,'Thịt nướng, đậu phộng và nước mắm chua ngọt.','Bún, thịt nướng, rau',false],
['Bún nem','Bún',52000,'Nem giòn dùng kèm bún tươi và rau.','Bún, nem, rau sống',false],
['Bún hải sản','Bún',68000,'Bún nóng với tôm, mực và rau thơm.','Bún, tôm, mực',false],
['Mì xào bò','Mì',59000,'Mì xào lửa lớn với bò và rau củ.','Mì, bò, cải xanh',true],
['Mì xào hải sản','Mì',65000,'Mì dai xào cùng hải sản tươi.','Mì, tôm, mực',false],
['Mì Ý bò bằm','Mì',69000,'Mì Ý sốt cà chua bò bằm đậm đà.','Mì Ý, bò, cà chua',true],
['Mì cay','Mì',59000,'Mì cay nóng hổi với topping phong phú.','Mì, xúc xích, nấm',false],
['Mì gà','Mì',52000,'Mì nóng với thịt gà và rau xanh.','Mì, gà, rau',false],
['Gà rán','Gà',39000,'Lớp vỏ vàng giòn, thịt gà mềm mọng.','Gà, bột chiên',true],
['Gà nướng','Gà',89000,'Gà nướng gia vị thơm lừng.','Gà, gia vị thảo mộc',true],
['Cánh gà chiên','Gà',49000,'Cánh gà chiên giòn, sốt tùy chọn.','Cánh gà, gia vị',false],
['Đùi gà sốt cay','Gà',45000,'Đùi gà phủ sốt cay ngọt hấp dẫn.','Gà, sốt cay',false],
['Gà sốt BBQ','Gà',55000,'Gà phủ sốt BBQ đậm vị.','Gà, sốt BBQ',false],
['Tôm rang','Hải sản',79000,'Tôm rang thơm cùng gia vị truyền thống.','Tôm, tỏi, hành',true],
['Tôm chiên','Hải sản',69000,'Tôm chiên giòn, dùng kèm sốt.','Tôm, bột chiên',false],
['Mực nướng','Hải sản',95000,'Mực nướng thơm, dai giòn vừa phải.','Mực, gia vị',true],
['Mực xào','Hải sản',85000,'Mực xào rau củ giữ độ giòn.','Mực, cần tây, hành',false],
['Cá chiên','Hải sản',72000,'Cá chiên vàng, ăn cùng nước chấm.','Cá, gia vị',false],
['Hải sản xào','Hải sản',99000,'Hải sản xào rau củ theo mùa.','Tôm, mực, rau củ',false],
['Burger bò','Burger',59000,'Burger bò cùng rau tươi và sốt đặc biệt.','Bánh mì, bò, rau',true],
['Burger gà','Burger',49000,'Burger gà giòn cùng rau và sốt.','Bánh mì, gà, rau',false],
['Pizza hải sản','Pizza',129000,'Pizza phô mai với topping hải sản.','Đế bánh, phô mai, hải sản',true],
['Pizza xúc xích','Pizza',109000,'Pizza xúc xích và phô mai kéo sợi.','Đế bánh, xúc xích, phô mai',false],
['Khoai tây chiên','Đồ ăn nhanh',35000,'Khoai tây chiên vàng giòn.','Khoai tây, muối',false],
['Xúc xích','Đồ ăn nhanh',29000,'Xúc xích áp chảo dùng cùng tương sốt.','Xúc xích',false],
['Trà đào','Trà',35000,'Trà thơm cùng đào ngâm mát lạnh.','Trà, đào',true],
['Trà chanh','Trà',25000,'Trà chanh chua ngọt giải khát.','Trà, chanh',false],
['Trà tắc','Trà',25000,'Trà tắc thơm nhẹ, chua ngọt.','Trà, tắc',false],
['Cà phê sữa','Cà phê',30000,'Cà phê thơm hòa cùng sữa đặc.','Cà phê, sữa',true],
['Cà phê đen','Cà phê',27000,'Cà phê đậm vị truyền thống.','Cà phê',false],
['Nước cam','Đồ uống',35000,'Nước cam chua ngọt, dễ uống.','Cam tươi',false],
['Coca','Nước ngọt',18000,'Nước giải khát có gas.','Nước uống',false],
['Pepsi','Nước ngọt',18000,'Nước giải khát có gas.','Nước uống',false],
['Nước suối','Đồ uống',12000,'Nước uống đóng chai.','Nước tinh khiết',false],
['Chè','Tráng miệng',25000,'Chè ngọt mát theo ngày.','Đậu, nước cốt dừa',false],
['Kem vani','Tráng miệng',30000,'Kem vani thơm dịu.','Sữa, vani',false],
['Kem chocolate','Tráng miệng',32000,'Kem chocolate mát lạnh.','Sữa, cacao',false],
['Flan','Tráng miệng',22000,'Bánh flan mềm mịn cùng caramel.','Trứng, sữa, caramel',false],
['Trái cây','Tráng miệng',39000,'Đĩa trái cây tươi theo mùa.','Trái cây theo mùa',false]
];
function imageFor(category,index) {
 const picks={
 'Cơm':['photo-1512058564366-18510be2db19','photo-1546069901-ba9599a7e63c'],
 'Phở':['photo-1582878826629-29b7ad1cdc43','photo-1569718212165-3a8278d5f624'],
 'Bún':['photo-1555126634-323283e090fa','photo-1547592180-85f173990554'],
 'Mì':['photo-1569718212165-3a8278d5f624','photo-1555949258-eb67b1ef0ceb'],
 'Gà':['photo-1626082927389-6cd097cdc6ec','photo-1562967914-608f82629710'],
 'Hải sản':['photo-1559737558-2f5a35f4523b','photo-1510130387422-82bed34b37e9'],
 'Burger':['photo-1568901346375-23c9450c58cd','photo-1550547660-d9450f859349'],
 'Đồ ăn nhanh':['photo-1573080496219-bb080dd4f877','photo-1568901346375-23c9450c58cd'],
 'Trà':['photo-1556679343-c7306c1976bc','photo-1544145945-f90425340c7e'],
 'Cà phê':['photo-1509042239860-f550ce710b93','photo-1461023058943-07fcbe16d735'],
 'Nước ngọt':['photo-1544145945-f90425340c7e','photo-1513558161293-cdaf765edfd7'],
 'Đồ uống':['photo-1544145945-f90425340c7e','photo-1513558161293-cdaf765edfd7'],
 'Tráng miệng':['photo-1488477181946-6428a0291777','photo-1563805042-7684c019e1cb'],
 'Pizza':['photo-1513104890138-7c749659a591','photo-1579751626657-72bc17010498']
 };
 const list=picks[category]||['photo-1547592180-85f173990554','photo-1546069901-ba9599a7e63c'];
 return `https://images.unsplash.com/${list[index%list.length]}?auto=format&fit=crop&w=800&q=80`;
}
function ensureDefaults() {
 if(!localStorage.getItem(KEYS.foods)) {
  const foods=seedFoods.map((r,i)=>({id:'F'+String(i+1).padStart(3,'0'),name:r[0],category:r[1],price:r[2],description:r[3],ingredients:r[4],rating:(4.6+(i%5)*.1).toFixed(1),sold:0,popular:r[5],newItem:i%9===0,available:true,image:imageFor(r[1],i),visible:true}));
  saveData(KEYS.foods,foods);
 }
 if(!localStorage.getItem(KEYS.categories)) saveData(KEYS.categories,defaultCategories);
 if(!localStorage.getItem(KEYS.orders)) saveData(KEYS.orders,[]);
 if(!localStorage.getItem(KEYS.favorites)) saveData(KEYS.favorites,[]);
 if(!localStorage.getItem(KEYS.reviews)) saveData(KEYS.reviews,[]);
 if(!localStorage.getItem(KEYS.toppings)) saveData(KEYS.toppings,[{name:'Trứng',price:10000},{name:'Xúc xích',price:15000},{name:'Phô mai',price:15000},{name:'Thịt thêm',price:20000},{name:'Rau thêm',price:5000}]);
 if(!localStorage.getItem(KEYS.sizes)) saveData(KEYS.sizes,[{name:'Nhỏ',price:0},{name:'Vừa',price:10000},{name:'Lớn',price:20000}]);
 if(!localStorage.getItem(KEYS.coupons)) saveData(KEYS.coupons,[{code:'WELCOME10',percent:10,minimum:0,active:true},{code:'FOOD20',percent:20,minimum:150000,active:true},{code:'SALE50',percent:50000,minimum:300000,active:true,amount:true}]);
 // Luôn giữ mã chào mừng dùng được cho khách mới, kể cả dữ liệu cũ thiếu mã này.
 const couponDefaults=loadData(KEYS.coupons,[]);
 const welcomeCoupon=couponDefaults.find(c=>String(c.code||'').toUpperCase()==='WELCOME10');if(!welcomeCoupon){couponDefaults.unshift({code:'WELCOME10',percent:10,minimum:0,active:true});saveData(KEYS.coupons,couponDefaults)}else if(welcomeCoupon.active===false){welcomeCoupon.active=true;saveData(KEYS.coupons,couponDefaults)}
 if(!localStorage.getItem(KEYS.tables)) saveData(KEYS.tables,Array.from({length:20},(_,i)=>({id:i+1,name:'Bàn '+String(i+1).padStart(2,'0'),status:'Trống'})));
 if(!localStorage.getItem(KEYS.notifications)) saveData(KEYS.notifications,[]);
 if(!localStorage.getItem(KEYS.settings)) saveData(KEYS.settings,{name:'QUÁN NGON',phone:'0900 000 000',address:'Địa chỉ nhà hàng',hours:'08:00 – 22:00',deliveryFee:15000,minimumOrder:0,acceptingOrders:true,soundEnabled:true});
}
function getFoods(){return loadData(KEYS.foods,[])}
function getOrders(){return loadData(KEYS.orders,[])}
async function apiRequest(url, options={}){
  if (location.protocol === 'file:') throw new Error('Bạn đang mở file HTML trực tiếp. Hãy chạy START.bat hoặc npm start, rồi mở http://localhost:3000.');
  let response;
  try {
    response = await fetch(url, { credentials:'same-origin', headers:{'Content-Type':'application/json', ...(options.headers||{})}, ...options, signal: options.signal || AbortSignal.timeout(15000) });
  } catch (cause) {
    if (cause?.name === 'TimeoutError' || cause?.name === 'AbortError') throw new Error('Máy chủ phản hồi quá chậm. Hãy kiểm tra trạng thái máy chủ rồi thử lại.');
    throw new Error('Không thể kết nối máy chủ. Hãy kiểm tra website đang được chạy bằng server.js và địa chỉ hosting có hỗ trợ Node.js.');
  }
  let data={}; try { data=await response.json(); } catch(e) {}
  if (!response.ok) {
    if (response.status === 405) {
      throw new Error('HTTP 405: Cổng này không chạy đúng API Quán Ngon hoặc đang dùng máy chủ cũ. Hãy mở đúng URL Website được in trong cửa sổ server.js (ví dụ http://localhost:3001), không mở bằng Live Server/file HTML.');
    }
    throw new Error(data.error || `Máy chủ trả về lỗi HTTP ${response.status}.`);
  }
  return data;
}
async function refreshOrdersFromServer(){try{let url='/api/admin/orders';if(document.body.dataset.page!=='admin'){let phone='';try{phone=localStorage.getItem('restaurant_customer_tracking_phone')||''}catch(e){}if(!phone)return;url='/api/orders?phone='+encodeURIComponent(phone)}const data=await apiRequest(url);if(Array.isArray(data.orders)){try{localStorage.setItem(KEYS.orders,JSON.stringify(data.orders))}catch(e){}if(document.body.dataset.page==='admin'){renderOverview();renderOrders();const all=getOrders();$('#newOrderBadge').textContent=all.filter(o=>o.status==='Mới').length;checkNewOrderAlerts()}}}catch(e){if(document.body.dataset.page==='admin'&&hasAdminSession())console.warn('Không đồng bộ được đơn hàng:',e.message)}}
function getSettings(){return loadData(KEYS.settings,{})}
const ORDER_ALERT_SEEN_KEY='restaurant_order_alert_seen_v2';
function checkNewOrderAlerts(){
 const page=document.body.dataset.page;
 if(page!=='admin')return;
 const orders=getOrders().filter(o=>o.fulfillment!=='pickup'&&o.status!=='Đã hủy');
 let seen=[];try{seen=JSON.parse(sessionStorage.getItem(ORDER_ALERT_SEEN_KEY)||'[]')}catch(e){}
 if(!Array.isArray(seen))seen=[];
 const fresh=orders.filter(o=>!seen.includes(o.id));
 if(fresh.length){
  const message=fresh.length===1?`Đơn mới ${fresh[0].id} · ${fresh[0].customerName||'Khách hàng'} · ${money(fresh[0].total)}`:`Có ${fresh.length} đơn giao hàng mới cần xem`;
  toast('🔔 '+message);
  if('Notification' in window&&Notification.permission==='granted'){try{new Notification('Quán Ngon · Admin',{body:message,tag:'restaurant-new-orders-'+fresh[0].id})}catch(e){}}
  seen=[...new Set([...fresh.map(o=>o.id),...seen])].slice(0,500);try{sessionStorage.setItem(ORDER_ALERT_SEEN_KEY,JSON.stringify(seen))}catch(e){}
 }
}
function enableOrderNotifications(){
 if(!('Notification' in window)){toast('Trình duyệt này không hỗ trợ thông báo hệ thống','warning');return}
 if(Notification.permission==='granted'){toast('Thông báo đơn hàng đã được bật');return}
 Notification.requestPermission().then(permission=>toast(permission==='granted'?'Đã bật thông báo đơn hàng':'Bạn chưa cấp quyền thông báo','warning'));
}
function statusPill(status){return `<span class="status-pill" data-status="${safe(status)}">${safe(status)}</span>`}
function openModal(id){const el=document.getElementById(id);if(el)el.classList.add('open');document.body.style.overflow='hidden'}
function closeModal(id){const el=document.getElementById(id);if(el)el.classList.remove('open');if(!$('.modal-wrap.open')&&!$('#cartDrawer.open'))document.body.style.overflow=''}
$$('[data-close]').forEach(btn=>btn.addEventListener('click',()=>closeModal(btn.dataset.close)));
$$('.modal-wrap').forEach(w=>w.addEventListener('click',e=>{if(e.target===w)closeModal(w.id)}));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){ $$('.modal-wrap.open').forEach(m=>closeModal(m.id));closeCart();$('#mobileNav')?.classList.remove('open');$('#adminSidebar')?.classList.remove('open');}if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#foodSearch')?.focus();}});
async function createChannelOrder(order){
 const result=await apiRequest('/api/orders',{method:'POST',body:JSON.stringify(order)});
 const saved=result.order||order;const list=getOrders().filter(o=>o.id!==saved.id);list.unshift(saved);saveData(KEYS.orders,list);
 const notes=loadData(KEYS.notifications,[]);notes.unshift({id:uid(),orderId:saved.id,message:`Đơn mới ${saved.id} · ${saved.customerName} · ${money(saved.total)}`,createdAt:nowISO(),read:false,for:['admin']});saveData(KEYS.notifications,notes);return saved;
}
function makeOrderId(){const d=new Date();return `QN-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${Math.floor(1000+Math.random()*9000)}`;}
function getStatusMessage(status){return ({'Mới':'Quán đang tiếp nhận đơn hàng.','Đã xác nhận':'Quán đã xác nhận đơn hàng của bạn.','Đang chuẩn bị':'Đơn hàng đang được chuẩn bị.','Sẵn sàng':'Đơn hàng đã sẵn sàng.','Đang giao':'Đơn hàng đang được giao.','Hoàn thành':'Đơn hàng đã hoàn thành.','Đã hủy':'Đơn hàng đã bị hủy.'})[status]||status;}

/* CUSTOMER */
let activeCategory='Tất cả', searchText='', cart=loadData('restaurant_cart',[]), activeCoupon=null, currentDetail=null, detailQty=1;
function saveCart(){saveData('restaurant_cart',cart);renderCart()}
function cartKey(item){return [item.foodId,item.size?.name||'',(item.toppings||[]).map(t=>t.name).sort().join(','),item.note||''].join('|')}
function getCartPrice(item){return Number(item.basePrice||item.price||0)+Number(item.size?.price||0)+(item.toppings||[]).reduce((s,t)=>s+Number(t.price||0),0)}
function cartTotals(){
 const subtotal=cart.reduce((s,it)=>s+getCartPrice(it)*it.qty,0),settings=getSettings();
 const delivery=cart.length&&cart.some(it=>it.fulfillment==='delivery')?Number(settings.deliveryFee||0):Number(settings.deliveryFee||0);
 let discount=0;if(activeCoupon){if(activeCoupon.minimum<=subtotal)discount=activeCoupon.amount?Math.min(subtotal,activeCoupon.percent):Math.round(subtotal*activeCoupon.percent/100);}
 return {subtotal,delivery:cart.length?delivery:0,discount,total:Math.max(0,subtotal+(cart.length?delivery:0)-discount)};
}
function renderCategories(){
 const list=$('#categoryList');if(!list)return;
 const cats=['Tất cả',...loadData(KEYS.categories,defaultCategories)];
 list.innerHTML=cats.map(c=>`<button class="category-chip ${activeCategory===c?'active':''}" data-category="${safe(c)}">${safe(c)}</button>`).join('');
 list.onclick=e=>{const b=e.target.closest('[data-category]');if(!b)return;activeCategory=b.dataset.category;renderCategories();renderFoods()};
}
function renderFoods(){
 const grid=$('#foodGrid');if(!grid)return;
 let foods=getFoods().filter(f=>f.visible!==false);
 if(activeCategory!=='Tất cả')foods=foods.filter(f=>f.category===activeCategory);
 if(searchText)foods=foods.filter(f=>(f.name+' '+f.category+' '+f.description).toLowerCase().includes(searchText.toLowerCase()));
 const sort=$('#sortFoods')?.value||'featured';
 if(sort==='priceAsc')foods.sort((a,b)=>a.price-b.price);else if(sort==='priceDesc')foods.sort((a,b)=>b.price-a.price);else if(sort==='rating')foods.sort((a,b)=>Number(b.rating)-Number(a.rating));else foods.sort((a,b)=>Number(b.popular)-Number(a.popular));
 $('#foodResultCount').textContent=`${foods.length} món trong thực đơn`;
 if(!foods.length){grid.innerHTML='<div class="empty-state">Không tìm thấy món phù hợp. Hãy thử từ khóa khác nhé.</div>';return}
 const favorites=loadData(KEYS.favorites,[]);
 grid.innerHTML=foods.map((f,i)=>`<article class="food-card" style="animation-delay:${Math.min(i,10)*.025}s"><div class="food-image" data-detail="${safe(f.id)}">${img(f.image,f.name)}<div class="food-badges">${f.popular?'<span class="food-badge hot">🔥 Bán chạy</span>':''}${f.newItem?'<span class="food-badge">✦ Món mới</span>':''}</div><button class="favorite-btn ${favorites.includes(f.id)?'is-favorite':''}" data-favorite="${safe(f.id)}" aria-label="Yêu thích">${favorites.includes(f.id)?'♥':'♡'}</button>${!f.available?'<div class="soldout-overlay">HẾT MÓN</div>':''}</div><div class="food-info"><div class="food-info-top"><span class="food-category">${safe(f.category)}</span><span class="rating">★ ${safe(f.rating||'4.8')}</span></div><h3 data-detail="${safe(f.id)}">${safe(f.name)}</h3><p>${safe(f.description||'Món ngon được chuẩn bị mỗi ngày.')}</p><div class="food-card-bottom"><span class="food-price">${money(f.price)}</span><button class="add-btn" data-quick-add="${safe(f.id)}" ${!f.available?'disabled':''} aria-label="Thêm ${safe(f.name)} vào giỏ">+</button></div></div></article>`).join('');
 grid.onclick=e=>{
  const fav=e.target.closest('[data-favorite]');if(fav){e.stopPropagation();toggleFavorite(fav.dataset.favorite);return}
  const add=e.target.closest('[data-quick-add]');if(add){quickAdd(add.dataset.quickAdd);return}
  const det=e.target.closest('[data-detail]');if(det)showFoodDetail(det.dataset.detail);
 };
}
function toggleFavorite(id){let fav=loadData(KEYS.favorites,[]);if(fav.includes(id)){fav=fav.filter(x=>x!==id);toast('Đã bỏ khỏi yêu thích')}else{fav.push(id);toast('Đã thêm vào món yêu thích')}saveData(KEYS.favorites,fav);renderFoods()}
function quickAdd(id){const f=getFoods().find(x=>x.id===id);if(!f||!f.available){toast('Món này hiện đã hết hàng','warning');return}addCartItem({foodId:f.id,name:f.name,image:f.image,basePrice:Number(f.price),price:Number(f.price),size:{name:'Mặc định',price:0},toppings:[],note:'',qty:1});toast('Đã thêm món vào giỏ')}
function showFoodDetail(id){
 const f=getFoods().find(x=>x.id===id);if(!f)return;currentDetail=f;detailQty=1;
 const sizes=loadData(KEYS.sizes,[{name:'Nhỏ',price:0},{name:'Vừa',price:10000},{name:'Lớn',price:20000}]);
 const toppings=loadData(KEYS.toppings,[]);
 $('#foodModalContent').innerHTML=`<div class="food-detail">${img(f.image,f.name).replace('<img ','<img class="food-detail-image" ')}<div class="food-detail-content"><span class="eyebrow">${safe(f.category)}</span><h2>${safe(f.name)}</h2><div class="rating">★ ${safe(f.rating||'4.8')} <span style="color:var(--muted);font-weight:500"> · ${Number(f.sold||0)} lượt gọi</span></div><div class="detail-price">${money(f.price)}</div><p>${safe(f.description||'Món ngon được chuẩn bị mỗi ngày.')}</p><small class="muted">Thành phần: ${safe(f.ingredients||'Nguyên liệu tươi ngon')}</small><span class="detail-label">Chọn size</span><div class="option-chips" id="sizeOptions">${sizes.map((s,i)=>`<button type="button" class="option-chip ${i===1||(!sizes[1]&&i===0)?'selected':''}" data-size="${i}">${safe(s.name)}${s.price?` (+${money(s.price)})`:''}</button>`).join('')}</div><span class="detail-label">Topping thêm</span><div>${toppings.map((t,i)=>`<div class="topping-line"><label><input type="checkbox" data-topping="${i}"> ${safe(t.name)}</label><span>+${money(t.price)}</span></div>`).join('')}</div><span class="detail-label">Ghi chú món</span><textarea id="detailNote" class="detail-note" placeholder="Ít cay, không hành..." maxlength="250"></textarea><div class="detail-qty"><button type="button" id="detailMinus">−</button><b id="detailQty">1</b><button type="button" id="detailPlus">+</button></div><button class="btn btn-primary btn-full" id="detailAdd" ${!f.available?'disabled':''}>${f.available?'Thêm vào giỏ · '+money(f.price):'Món hiện đã hết'}</button></div></div>`;
 let selectedSize=sizes.find(s=>s.name==='Vừa')||sizes[0]||{name:'Mặc định',price:0};
 const updateDetailPrice=()=>{const chosen=toppings.filter((_,i)=>$(`[data-topping="${i}"]`,$('#foodModalContent'))?.checked);const total=(Number(f.price)+Number(selectedSize.price||0)+chosen.reduce((s,t)=>s+Number(t.price||0),0))*detailQty;$('#detailAdd').textContent=`Thêm vào giỏ · ${money(total)}`;$('#detailQty').textContent=detailQty};
 $('#sizeOptions').onclick=e=>{const b=e.target.closest('[data-size]');if(!b)return;$$('.option-chip',$('#sizeOptions')).forEach(x=>x.classList.remove('selected'));b.classList.add('selected');selectedSize=sizes[Number(b.dataset.size)]||sizes[0];updateDetailPrice()};
 $('#foodModalContent').onchange=e=>{if(e.target.matches('[data-topping]'))updateDetailPrice()};
 $('#detailMinus').onclick=()=>{detailQty=Math.max(1,detailQty-1);updateDetailPrice()};
 $('#detailPlus').onclick=()=>{detailQty=Math.min(99,detailQty+1);updateDetailPrice()};
 $('#detailAdd').onclick=()=>{const chosen=toppings.filter((_,i)=>$(`[data-topping="${i}"]`,$('#foodModalContent'))?.checked);addCartItem({foodId:f.id,name:f.name,image:f.image,basePrice:Number(f.price),size:{name:selectedSize.name,price:Number(selectedSize.price||0)},toppings:chosen.map(t=>({...t})),note:$('#detailNote').value.trim(),qty:detailQty});closeModal('foodModal');toast('Đã thêm món vào giỏ')};
 openModal('foodModal');updateDetailPrice();
}
function addCartItem(item){const key=cartKey(item);const found=cart.find(x=>cartKey(x)===key);if(found)found.qty=Math.min(99,found.qty+item.qty);else cart.push(item);saveCart()}
function renderCart(){
 const count=cart.reduce((s,i)=>s+i.qty,0);if($('#cartCount'))$('#cartCount').textContent=count;if($('#drawerCartCount'))$('#drawerCartCount').textContent=`(${count})`;
 const box=$('#cartItems');if(!box)return;
 if(!cart.length)box.innerHTML='<div class="cart-empty"><span>🛍️</span><b>Giỏ hàng đang trống</b><p>Chọn một món ngon để bắt đầu nhé.</p><button class="btn btn-outline" id="browseMenu">Khám phá thực đơn</button></div>';
 else box.innerHTML=cart.map((it,i)=>`<div class="cart-line">${img(it.image,it.name)}<div><h4>${safe(it.name)}</h4><small>${safe(it.size?.name||'Mặc định')}${it.toppings?.length?' · '+safe(it.toppings.map(t=>t.name).join(', ')):''}</small>${it.note?`<small>Ghi chú: ${safe(it.note)}</small>`:''}<div class="qty-control"><button data-cart-dec="${i}">−</button><span>${it.qty}</span><button data-cart-inc="${i}">+</button></div><button class="remove-line" data-cart-remove="${i}">Xóa món</button></div><b class="line-price">${money(getCartPrice(it)*it.qty)}</b></div>`).join('');
 box.onclick=e=>{if(e.target.id==='browseMenu'){closeCart();$('#menu').scrollIntoView();return}const dec=e.target.closest('[data-cart-dec]');const inc=e.target.closest('[data-cart-inc]');const rem=e.target.closest('[data-cart-remove]');if(dec){const i=Number(dec.dataset.cartDec);cart[i].qty--;if(cart[i].qty<=0)cart.splice(i,1);saveCart()}if(inc){const i=Number(inc.dataset.cartInc);cart[i].qty=Math.min(99,cart[i].qty+1);saveCart()}if(rem){cart.splice(Number(rem.dataset.cartRemove),1);saveCart()}};
 const t=cartTotals();if($('#subtotalValue'))$('#subtotalValue').textContent=money(t.subtotal);if($('#deliveryValue'))$('#deliveryValue').textContent=money(t.delivery);if($('#discountValue'))$('#discountValue').textContent='−'+money(t.discount);if($('#totalValue'))$('#totalValue').textContent=money(t.total);if($('#checkoutTotal'))$('#checkoutTotal').textContent=money(t.total);
}
function openCart(){ $('#cartDrawer')?.classList.add('open');$('#overlay')?.classList.add('visible');document.body.style.overflow='hidden';renderCart()}
function closeCart(){ $('#cartDrawer')?.classList.remove('open');$('#overlay')?.classList.remove('visible');if(!$('.modal-wrap.open'))document.body.style.overflow=''}
function normalizePhone(value){
 let digits=String(value||'').replace(/\D/g,'');
 if(digits.startsWith('84')&&digits.length>=11)digits='0'+digits.slice(2);
 return digits;
}
function couponAlreadyUsed(code,phone){
 const normalized=normalizePhone(phone);if(!normalized)return false;
 return getOrders().some(order=>String(order.coupon||'').trim().toUpperCase()===String(code||'').trim().toUpperCase()&&normalizePhone(order.phone)===normalized&&order.status!=='Đã hủy');
}
function applyCoupon(){
 const code=($('#couponInput')?.value||'').trim().toUpperCase();if(!code){toast('Vui lòng nhập mã giảm giá','warning');return}
 const c=loadData(KEYS.coupons,[]).find(x=>String(x.code||'').toUpperCase()===code&&x.active!==false);
 if(!c){activeCoupon=null;toast('Mã giảm giá không hợp lệ','error');renderCart();return}
 const knownPhone=normalizePhone(loadData('restaurant_customer_tracking_phone',''));
 if(knownPhone&&couponAlreadyUsed(code,knownPhone)){activeCoupon=null;toast('Số điện thoại này đã sử dụng mã '+code+' cho đơn trước. Mỗi khách chỉ dùng mã này một lần.','error');renderCart();return}
 if(cartTotals().subtotal<Number(c.minimum||0)){toast(`Đơn tối thiểu ${money(c.minimum)} để dùng mã này`,'warning');return}
 activeCoupon=c;toast('Áp dụng mã thành công');renderCart();
}
function startCheckout(){
 if(!cart.length){toast('Giỏ hàng đang trống','warning');return}
 const settings=getSettings();if(settings.acceptingOrders===false){toast('Quán hiện không nhận đơn','error');return}
 if(cartTotals().subtotal<Number(settings.minimumOrder||0)){toast(`Đơn tối thiểu là ${money(settings.minimumOrder)}`,'warning');return}
 closeCart();
 const tableSel=$('[name="table"]');if(tableSel)tableSel.innerHTML='<option value="">Chọn bàn</option>'+loadData(KEYS.tables,[]).map(t=>`<option value="${t.id}">${safe(t.name)}</option>`).join('');
 openModal('checkoutModal');
}
function toggleFulfillment(){
 const pickup=$('[name="fulfillment"]:checked')?.value==='pickup';
 $('#addressField')?.classList.toggle('hidden',pickup);$('#tableField')?.classList.toggle('hidden',!pickup);
 const addr=$('[name="address"]');if(addr){addr.required=!pickup;if(pickup)addr.value=''}
}
const BANK_APPS = [
 {name:'Vietcombank',url:'https://www.vietcombank.com.vn/'},
 {name:'BIDV SmartBanking',url:'https://bidv.com.vn/'},
 {name:'VietinBank iPay',url:'https://ipay.vietinbank.vn/'},
 {name:'MB Bank',url:'https://www.mbbank.com.vn/'},
 {name:'Techcombank',url:'https://techcombank.com/'},
 {name:'ACB ONE',url:'https://online.acb.com.vn/'},
 {name:'VPBank NEO',url:'https://neo.vpbank.com.vn/'},
 {name:'TPBank',url:'https://tpb.vn/'},
 {name:'Sacombank',url:'https://www.sacombank.com.vn/'},
 {name:'VIB',url:'https://www.vib.com.vn/'},
 {name:'HDBank',url:'https://hdbank.com.vn/'},
 {name:'SHB',url:'https://www.shb.com.vn/'},
 {name:'OCB OMNI',url:'https://ocb.com.vn/'},
 {name:'MSB',url:'https://www.msb.com.vn/'},
 {name:'SeABank',url:'https://www.seabank.com.vn/'},
 {name:'LPBank',url:'https://lpbank.com.vn/'}
];
function buildTransferQr(order, settings){
 const code=String(settings.bankCode||'VCB').trim();
 const account=String(settings.bankAccount||'').trim();
 if(!account)return '';
 const params=new URLSearchParams({amount:String(Math.round(Number(order.total)||0)),addInfo:`Thanh toan ${order.id}`,accountName:String(settings.bankAccountName||'').trim()});
 return `https://img.vietqr.io/image/${encodeURIComponent(code)}-${encodeURIComponent(account)}-compact2.png?${params.toString()}`;
}
function renderTransferPanel(order){
 const panel=$('#bankTransferPanel');if(!panel)return;
 const s=getSettings();
 if(!String(order.payment||'').toLowerCase().includes('chuyển khoản')){panel.classList.add('hidden');panel.innerHTML='';return}
 if(s.bankTransferEnabled!==true||!String(s.bankAccount||'').trim()){
  panel.classList.remove('hidden');panel.innerHTML='<div class="transfer-warning">Quán chưa cấu hình tài khoản nhận chuyển khoản. Vui lòng liên hệ nhà hàng để được hỗ trợ.</div>';return;
 }
 const qr=s.bankQrImage||buildTransferQr(order,s);
 const bankLabel=({VCB:'Vietcombank',BIDV:'BIDV',ICB:'VietinBank',TCB:'Techcombank',MB:'MB Bank',ACB:'ACB',VPB:'VPBank',TPB:'TPBank',STB:'Sacombank',HDB:'HDBank',VIB:'VIB',SHB:'SHB',OCB:'OCB',MSB:'MSB',EIB:'Eximbank',LPB:'LPBank',ABB:'ABBank',SEAB:'SeABank',BVB:'BVBank'})[s.bankCode]||s.bankCode||'Ngân hàng';
 panel.classList.remove('hidden');
 panel.innerHTML=`<div class="transfer-heading"><b>Quét mã QR để chuyển khoản</b><small>Kiểm tra đúng số tiền và tên người nhận trước khi xác nhận.</small></div>${qr?`<img class="transfer-qr" src="${safe(qr)}" alt="Mã QR chuyển khoản" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><p class="transfer-warning" style="display:none">Không tải được mã QR. Vui lòng dùng thông tin chuyển khoản bên dưới.</p>`:''}<div class="transfer-details"><div><span>Ngân hàng</span><b>${safe(bankLabel)}</b></div><div><span>Số tài khoản</span><b>${safe(s.bankAccount)}</b><button class="small-action" type="button" data-copy-transfer="account">Sao chép</button></div><div><span>Chủ tài khoản</span><b>${safe(s.bankAccountName||'Chưa cập nhật')}</b></div><div><span>Số tiền</span><b>${money(order.total)}</b><button class="small-action" type="button" data-copy-transfer="amount">Sao chép</button></div><div><span>Nội dung chuyển khoản</span><b>${safe('Thanh toan '+order.id)}</b><button class="small-action" type="button" data-copy-transfer="memo">Sao chép</button></div></div><label class="bank-picker-label" for="transferBankPicker">Chọn ngân hàng để mở trang ngân hàng</label><select id="transferBankPicker" class="select-control">${BANK_APPS.map((b,i)=>`<option value="${i}">${safe(b.name)}</option>`).join('')}</select><button type="button" class="btn btn-primary btn-full" id="openBankAppBtn">Mở ngân hàng đã chọn ↗</button><p class="fine-print">Nếu nút không mở ứng dụng trên thiết bị của bạn, hãy mở app ngân hàng và quét mã QR. Website không tự xác nhận giao dịch; nhà hàng cần kiểm tra tiền đã vào tài khoản.</p>`;
 $('#openBankAppBtn').onclick=()=>{const selected=BANK_APPS[Number($('#transferBankPicker')?.value)||0];if(selected)window.open(selected.url,'_blank','noopener,noreferrer')};
 panel.onclick=async e=>{const btn=e.target.closest('[data-copy-transfer]');if(!btn)return;const values={account:s.bankAccount,amount:String(Math.round(Number(order.total)||0)),memo:`Thanh toan ${order.id}`};try{await navigator.clipboard.writeText(values[btn.dataset.copyTransfer]);toast('Đã sao chép')}catch(err){toast('Không thể sao chép tự động trên trình duyệt này','warning')}};
}
async function submitOrder(e){
 e.preventDefault();const form=e.currentTarget,btn=$('#placeOrderBtn');if(btn.disabled)return;
 if(!cart.length){toast('Giỏ hàng đang trống','warning');closeModal('checkoutModal');return}
 const fd=new FormData(form),fulfillment=fd.get('fulfillment'),address=String(fd.get('address')||'').trim(),phone=String(fd.get('phone')||'').trim();
 if(fulfillment==='delivery'&&!address){toast('Vui lòng nhập địa chỉ giao hàng','warning');return}
 if(fulfillment==='pickup'&&!fd.get('table')){toast('Vui lòng chọn bàn nhận món','warning');return}
 if(activeCoupon&&couponAlreadyUsed(activeCoupon.code,phone)){
  activeCoupon=null;renderCart();toast('Số điện thoại này đã sử dụng mã giảm giá cho đơn trước. Mỗi khách chỉ được dùng mã đó một lần. Đơn hàng chưa được gửi, vui lòng kiểm tra lại tổng tiền.','error');return;
 }
 btn.disabled=true;btn.textContent='ĐANG XỬ LÝ...';
 try{
  const totals=cartTotals(),settings=getSettings();
  try{localStorage.setItem('restaurant_customer_tracking_phone',phone)}catch(e){}
  const order={id:makeOrderId(),createdAt:nowISO(),updatedAt:nowISO(),customerName:String(fd.get('customerName')).trim(),phone,address:fulfillment==='pickup'?'Nhận tại quán':address,fulfillment,table:fulfillment==='pickup'?String(fd.get('table')):'',receiveTime:String(fd.get('receiveTime')),payment:String(fd.get('payment')),note:String(fd.get('orderNote')||'').trim(),items:cart.map(it=>({...it,price:getCartPrice(it)})),subtotal:totals.subtotal,deliveryFee:totals.delivery,discount:totals.discount,total:totals.total,coupon:activeCoupon?.code||'',status:'Mới',statusHistory:[{status:'Mới',at:nowISO()}]};
  const savedOrder=await createChannelOrder(order);
  cart=[];activeCoupon=null;saveCart();form.reset();toggleFulfillment();closeModal('checkoutModal');
  $('#successOrderId').textContent=savedOrder.id;$('#successOrderTotal').textContent=money(savedOrder.total);renderTransferPanel(savedOrder);openModal('successModal');
 }catch(err){toast('Không thể gửi đơn lên máy chủ: '+(err.message||'Vui lòng thử lại'),'error')}finally{btn.disabled=false;btn.textContent='Xác nhận đặt món'}
}
async function findCustomerOrders(){
 const renderHistory=(list,expandId='')=>{
  $('#historyResults').innerHTML=list.length?list.map(o=>`<article class="history-order"><div class="history-order-head"><div><h4>${safe(o.id)}</h4><p>${dateLabel(o.createdAt)} · ${(o.items||[]).reduce((sum,i)=>sum+Number(i.qty||0),0)} món</p></div><div>${statusPill(o.status)}<p><b style="color:var(--primary)">${money(o.total)}</b></p></div></div><p>${safe((o.items||[]).map(i=>`${i.name} ×${i.qty}`).join(', '))}</p><p>${safe(getStatusMessage(o.status))}</p><div class="history-order-actions"><button class="small-action" data-reorder="${safe(o.id)}">Đặt lại</button>${o.status==='Hoàn thành'?'<button class="small-action" data-review="'+safe(o.id)+'">Đánh giá</button>':''}</div><div id="track-${safe(o.id)}" class="${expandId===o.id?'':'hidden'} muted" style="font-size:10px;margin-top:10px"><b>Lịch sử trạng thái</b><br>${(o.statusHistory||[{status:o.status,at:o.updatedAt||o.createdAt}]).map(h=>`${safe(h.status)} · ${dateLabel(h.at)}`).join('<br>')}</div></article>`).join(''):'<div class="empty-state">Chưa có đơn hàng nào được lưu trên trình duyệt này. Sau khi đặt món, đơn hàng sẽ xuất hiện tại đây.</div>';
  $('#historyResults').onclick=e=>{
   const reorder=e.target.closest('[data-reorder]'),review=e.target.closest('[data-review]');
   if(reorder){const o=getOrders().find(x=>x.id===reorder.dataset.reorder);if(o){o.items.forEach(it=>{const f=getFoods().find(x=>x.id===it.foodId);if(f&&f.available)addCartItem({...it,qty:it.qty,basePrice:Number(f.price),price:Number(f.price)})});closeModal('historyModal');openCart();toast('Đã thêm các món còn bán vào giỏ')}}
   if(review){const o=getOrders().find(x=>x.id===review.dataset.review);if(o)showReviewForm(o)}
  };
 };
 // Chỉ hiển thị đơn được lưu cục bộ trên đúng trình duyệt này; tuyệt đối không tra cứu bằng số điện thoại.
 const list=getOrders().slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
 renderHistory(list);
}
function showReviewForm(order){
 const existing=document.getElementById('customerReviewDialog');if(existing)existing.remove();
 let selectedRating=5;
 const overlay=document.createElement('div');overlay.id='customerReviewDialog';overlay.className='review-dialog-backdrop';
 overlay.innerHTML=`<section class="review-dialog" role="dialog" aria-modal="true" aria-labelledby="reviewDialogTitle"><button type="button" class="review-dialog-close" data-review-close aria-label="Đóng">×</button><span class="eyebrow">CHIA SẺ TRẢI NGHIỆM</span><h2 id="reviewDialogTitle">Đánh giá đơn hàng</h2><p class="review-dialog-order">Đơn hàng <b>${safe(order.id)}</b></p><form id="customerReviewForm"><label class="review-field-label" for="customerReviewText">Nội dung đánh giá</label><textarea id="customerReviewText" name="reviewText" maxlength="1000" rows="4" placeholder="Hãy chia sẻ cảm nhận của bạn..." required></textarea><div class="review-rating-label">Đánh giá của bạn</div><div class="review-star-picker" role="group" aria-label="Chọn số sao">${[1,2,3,4,5].map(n=>`<button type="button" class="review-star-button ${n<=selectedRating?'selected':''}" data-review-star="${n}" aria-label="${n} sao" aria-pressed="${n<=selectedRating}">★</button>`).join('')}</div><div id="reviewRatingText" class="review-rating-text">5 sao · Tuyệt vời</div><div class="review-dialog-actions"><button type="button" class="btn btn-secondary" data-review-close>Hủy</button><button type="submit" class="btn btn-primary">Gửi đánh giá</button></div></form></section>`;
 document.body.appendChild(overlay);
 const close=()=>overlay.remove();
 overlay.addEventListener('click',e=>{if(e.target===overlay||e.target.closest('[data-review-close]'))close();});
 const starLabels={1:'1 sao · Chưa hài lòng',2:'2 sao · Bình thường',3:'3 sao · Khá tốt',4:'4 sao · Rất tốt',5:'5 sao · Tuyệt vời'};
 overlay.querySelectorAll('[data-review-star]').forEach(btn=>btn.addEventListener('click',()=>{selectedRating=Number(btn.dataset.reviewStar);overlay.querySelectorAll('[data-review-star]').forEach(star=>{const active=Number(star.dataset.reviewStar)<=selectedRating;star.classList.toggle('selected',active);star.setAttribute('aria-pressed',String(active));});overlay.querySelector('#reviewRatingText').textContent=starLabels[selectedRating];}));
 overlay.querySelector('#customerReviewForm').addEventListener('submit',async e=>{e.preventDefault();const text=overlay.querySelector('#customerReviewText').value.trim();if(!text){toast('Vui lòng nhập nội dung đánh giá','warning');return;}const submit=overlay.querySelector('button[type=submit]');submit.disabled=true;submit.textContent='Đang gửi...';try{await apiRequest('/api/reviews',{method:'POST',body:JSON.stringify({orderId:order.id,rating:selectedRating,text})});await renderCustomerReviews();if(typeof renderReviewsAdmin==='function'&&document.body.dataset.page==='admin')await renderReviewsAdmin();close();toast('Đã lưu đánh giá trên máy chủ. Cảm ơn bạn!');}catch(err){submit.disabled=false;submit.textContent='Gửi đánh giá';toast(err.message||'Không gửi được đánh giá. Vui lòng thử lại.','error');}});
 setTimeout(()=>overlay.querySelector('#customerReviewText')?.focus(),0);
}
let currentCustomerView='home';
const customerViewNames=['home','menu','bestsellers','offers','contact','reviews'];
function switchCustomerView(view,updateHash=true){
 if(!customerViewNames.includes(view))view='home';
 currentCustomerView=view;
 $$('.customer-view').forEach(el=>{const active=el.dataset.siteView===view;el.classList.toggle('view-hidden',!active);if(active)el.classList.add('view-enter')});
 $$('.desktop-nav [data-nav-view], .mobile-nav [data-nav-view]').forEach(a=>a.classList.toggle('active',a.dataset.navView===view));
 $('#mobileNav')?.classList.remove('open');
 if(updateHash){try{history.replaceState(null,'','#'+view)}catch(e){}}
 window.scrollTo({top:0,behavior:'instant'});
 if(view==='reviews')renderCustomerReviews();
 if(view==='bestsellers')renderPopularFoods();
}
async function renderCustomerReviews(){
 const el=$('#customerReviews');if(!el)return;
 try{const data=await apiRequest('/api/reviews');const reviews=Array.isArray(data.reviews)?data.reviews:[];
 el.innerHTML=reviews.length?reviews.slice(0,30).map(r=>`<article class="customer-review-card"><div class="customer-review-top"><b>${safe(r.customerName||'Khách hàng')}</b><span class="rating">${'★'.repeat(Math.max(0,Math.min(5,Number(r.rating)||0)))}${'☆'.repeat(5-Math.max(0,Math.min(5,Number(r.rating)||0)))}</span></div><p>${safe(r.text||'Khách hàng đã gửi đánh giá.')}</p><small>${dateLabel(r.createdAt)}</small></article>`).join(''):'<div class="empty-state">Chưa có đánh giá. Hãy chia sẻ trải nghiệm sau khi đơn hàng hoàn thành.</div>';
 }catch(e){el.innerHTML='<div class="empty-state">Chưa tải được đánh giá từ máy chủ. Vui lòng thử lại sau.</div>'; }
}
function renderPopularFoods(){
 const grid=$('#popularGrid');if(!grid)return;
 const foods=getFoods().filter(f=>f.visible!==false&&f.available!==false).sort((a,b)=>Number(b.popular)-Number(a.popular)||Number(b.sold||0)-Number(a.sold||0)).slice(0,6);
 const favorites=loadData(KEYS.favorites,[]);
 grid.innerHTML=foods.length?foods.map(f=>`<article class="food-card"><div class="food-image" data-detail="${safe(f.id)}">${img(f.image,f.name)}<div class="food-badges"><span class="food-badge hot">🔥 Bán chạy</span></div><button class="favorite-btn ${favorites.includes(f.id)?'is-favorite':''}" data-favorite="${safe(f.id)}" aria-label="Yêu thích">${favorites.includes(f.id)?'♥':'♡'}</button></div><div class="food-info"><div class="food-info-top"><span class="food-category">${safe(f.category)}</span><span class="rating">★ ${safe(f.rating||'4.8')}</span></div><h3 data-detail="${safe(f.id)}">${safe(f.name)}</h3><p>${safe(f.description||'Món ngon được chuẩn bị mỗi ngày.')}</p><div class="food-card-bottom"><span class="food-price">${money(f.price)}</span><button class="add-btn" data-quick-add="${safe(f.id)}" aria-label="Thêm ${safe(f.name)} vào giỏ">+</button></div></div></article>`).join(''):'<div class="empty-state">Chưa có món bán chạy.</div>';
 grid.onclick=e=>{const fav=e.target.closest('[data-favorite]');if(fav){e.stopPropagation();toggleFavorite(fav.dataset.favorite);renderPopularFoods();return}const add=e.target.closest('[data-quick-add]');if(add){quickAdd(add.dataset.quickAdd);return}const det=e.target.closest('[data-detail]');if(det)showFoodDetail(det.dataset.detail)};
}
function renderCustomer(){
 if(document.body.dataset.page!=='customer')return;
 const settings=getSettings();if($('#brandName'))$('#brandName').textContent=settings.name||'QUÁN NGON';if($('#footerBrand'))$('#footerBrand').textContent=settings.name||'QUÁN NGON';if($('#footerAddress'))$('#footerAddress').textContent=settings.address||'';if($('#footerPhone'))$('#footerPhone').textContent=settings.phone||'';if($('#footerHours'))$('#footerHours').textContent=settings.hours||'';
 if(settings.acceptingOrders===false&&!$('#closedBanner')){const b=document.createElement('div');b.id='closedBanner';b.style.cssText='padding:12px 20px;text-align:center;background:#fff0d4;color:#8b5c16;font-weight:800;font-size:12px';b.textContent='Quán hiện đã đóng cửa và tạm ngưng nhận đơn.';$('.site-header').after(b)}else if(settings.acceptingOrders!==false)$('#closedBanner')?.remove();
 renderCategories();renderFoods();renderCart();if(currentCustomerView==='bestsellers')renderPopularFoods();if(currentCustomerView==='reviews')renderCustomerReviews();
}
function initCustomer(){
 renderCustomer();
 $('#themeToggle').onclick=toggleTheme;$('#favoritesToggle').onclick=()=>{activeCategory='Tất cả';searchText='';$('#foodSearch').value='';const fav=loadData(KEYS.favorites,[]);if(!fav.length){toast('Bạn chưa có món yêu thích','warning');return}switchCustomerView('menu',true);$('#foodGrid').innerHTML=getFoods().filter(f=>fav.includes(f.id)).map(f=>`<article class="food-card"><div class="food-image" data-detail="${safe(f.id)}">${img(f.image,f.name)}</div><div class="food-info"><h3 data-detail="${safe(f.id)}">${safe(f.name)}</h3><div class="food-card-bottom"><span class="food-price">${money(f.price)}</span><button class="add-btn" data-quick-add="${safe(f.id)}">+</button></div></div></article>`).join('')};
 $('#cartToggle').onclick=openCart;$('#closeCart').onclick=closeCart;$('#overlay').onclick=closeCart;
 $('#mobileMenuToggle').onclick=()=>$('#mobileNav').classList.toggle('open');
 $$('a[href^="#"]').forEach(a=>{const target=a.getAttribute('href').slice(1);if(customerViewNames.includes(target)){a.addEventListener('click',e=>{e.preventDefault();switchCustomerView(target,true)});}});
 $('#foodSearch').addEventListener('input',e=>{searchText=e.target.value.trim();renderFoods()});$('#sortFoods').onchange=renderFoods;
 $('#showPopular').onclick=()=>switchCustomerView('menu',true);
 $('#reviewHistoryBtn').onclick=()=>{const title=$('#historyModalTitle'),hint=$('#historyModalHint'),eyebrow=$('#historyModalEyebrow');if(title)title.textContent='Đánh giá đơn đã hoàn thành';if(hint)hint.textContent='Chỉ hiển thị đơn đã lưu trên trình duyệt và thiết bị này. Chọn Đánh giá ở đơn có trạng thái Hoàn thành.';if(eyebrow)eyebrow.textContent='CHIA SẺ TRẢI NGHIỆM';openModal('historyModal');findCustomerOrders()};
 $('#copyCoupon').onclick=()=>{if(navigator.clipboard?.writeText)navigator.clipboard.writeText('WELCOME10').then(()=>toast('Đã sao chép mã WELCOME10')).catch(()=>toast('Mã ưu đãi: WELCOME10'));else toast('Mã ưu đãi: WELCOME10')};
 $('#applyCoupon').onclick=applyCoupon;$('#checkoutBtn').onclick=startCheckout;$('#checkoutForm').onsubmit=submitOrder;$$('[name="fulfillment"]').forEach(r=>r.onchange=toggleFulfillment);
 $('#historyBtn').onclick=()=>{const title=$('#historyModalTitle'),hint=$('#historyModalHint'),eyebrow=$('#historyModalEyebrow');if(title)title.textContent='Đơn hàng đã đặt';if(hint)hint.textContent='Các đơn hàng đã đặt trên trình duyệt và thiết bị này. Không cần nhập số điện thoại.';if(eyebrow)eyebrow.textContent='THEO DÕI VÀ XEM LẠI';openModal('historyModal');findCustomerOrders()};
 $('#couponInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();applyCoupon()}});
 $('#foodSearch').addEventListener('keydown',e=>{if(e.key==='Escape'){e.target.value='';searchText='';renderFoods()}});
 const initial=(location.hash||'#home').slice(1);switchCustomerView(customerViewNames.includes(initial)?initial:'home',false);
}

/* ADMIN */
const statusOptions=['Mới','Đã xác nhận','Đang chuẩn bị','Sẵn sàng','Đang giao','Hoàn thành','Đã hủy'];
let editingImage='',knownOrderIds=new Set();
function normalizeAdminPhone(value){return String(value||'').replace(/[\s().-]/g,'').trim()}
function setAdminSession(active){/* Phiên đăng nhập do máy chủ quản lý bằng cookie HttpOnly. */}
function hasAdminSession(){return document.body.dataset.page==='admin'&&$('#adminLogin')?.classList.contains('hidden')}
async function openAdminApp(){ $('#adminLogin').classList.add('hidden');$('#adminApp').classList.remove('hidden');try{const me=await apiRequest('/api/admin/me');if($('#currentAdminPhone'))$('#currentAdminPhone').value=me.phone||''}catch(e){}renderAdmin();refreshOrdersFromServer(); }
function adminLogin(){
 const login=$('#adminLogin'),app=$('#adminApp'),setupPanel=$('#adminSetupPanel'),loginPanel=$('#adminLoginPanel');
 (async()=>{try{const state=await apiRequest('/api/admin/status');if(state.setupRequired){loginPanel.classList.add('hidden');setupPanel.classList.remove('hidden')}else{loginPanel.classList.remove('hidden');setupPanel.classList.add('hidden')}const me=await apiRequest('/api/admin/me');if(me.authenticated){openAdminApp();$('#currentAdminPhone')&&($('#currentAdminPhone').value=me.phone||'')}}catch(err){toast('Không kết nối được máy chủ. Hãy chạy ứng dụng qua server.js, không mở file HTML trực tiếp.','error')}})();
 $('#adminSetupForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.currentTarget),phone=normalizeAdminPhone(fd.get('phone')),password=String(fd.get('password')||''),confirm=String(fd.get('confirmPassword')||''),bootstrapSecret=String(fd.get('bootstrapSecret')||'');if(phone.replace(/\D/g,'').length<9){toast('Số điện thoại Admin chưa hợp lệ','error');return}if(password.length<12){toast('Mật khẩu quản trị cần ít nhất 12 ký tự','error');return}if(password!==confirm){toast('Mật khẩu nhập lại không khớp','error');return}try{await apiRequest('/api/admin/setup',{method:'POST',body:JSON.stringify({phone,password,bootstrapSecret})});toast('Đã tạo tài khoản quản trị trên máy chủ. Hãy đăng nhập.');e.currentTarget.reset();location.reload()}catch(err){toast(err.message||'Không tạo được tài khoản','error')}};
 $('#loginForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);try{await apiRequest('/api/admin/login',{method:'POST',body:JSON.stringify({phone:normalizeAdminPhone(fd.get('phone')),password:String(fd.get('password')||'')})});openAdminApp();toast('Đăng nhập Admin thành công')}catch(err){toast(err.message||'Đăng nhập thất bại','error')}};
}
function showAdminView(view){
 $$('.admin-view').forEach(v=>v.classList.toggle('hidden',v.id!=='view-'+view));
 $$('.side-link[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
 const labels={overview:'Tổng quan',orders:'Đơn hàng',foods:'Món ăn',categories:'Danh mục',coupons:'Khuyến mãi',reviews:'Đánh giá',settings:'Cài đặt'};
 $('#adminPageTitle').textContent=labels[view]||'Quản trị';
 $('#adminSidebar').classList.remove('open');
 if(view==='orders')renderOrders();if(view==='foods')renderFoodsAdmin();if(view==='categories')renderCategoriesAdmin();if(view==='coupons')renderCouponsAdmin();if(view==='reviews')renderReviewsAdmin();if(view==='settings')renderSettingsAdmin();
}
function renderFoodsAdmin(){
 const body=$('#foodsTable'); if(!body)return;
 const q=($('#foodAdminSearch')?.value||'').trim().toLowerCase();
 const foods=getFoods().filter(f=>!q||[f.name,f.category].join(' ').toLowerCase().includes(q));
 body.innerHTML=foods.length?foods.map(f=>`<tr><td><div class="table-food">${img(f.image,f.name)}<div><b>${safe(f.name)}</b><small>${safe(f.description||'')}</small></div></div></td><td>${safe(f.category||'Khác')}</td><td>${money(f.price)}</td><td>${f.available!==false&&f.visible!==false?'<span class="status-pill" data-status="Hoàn thành">Đang bán</span>':'<span class="status-pill" data-status="Đã hủy">Tạm ẩn / hết món</span>'}</td><td><button class="small-action" data-edit-food="${safe(f.id)}">Sửa</button> <button class="small-action" data-toggle-food="${safe(f.id)}">${f.available!==false?'Hết món':'Mở bán'}</button> <button class="small-action" data-delete-food="${safe(f.id)}">Xóa</button></td></tr>`).join(''):'<tr><td colspan="5"><div class="empty-state">Chưa có món ăn phù hợp.</div></td></tr>';
 body.onclick=e=>{const edit=e.target.closest('[data-edit-food]'),toggle=e.target.closest('[data-toggle-food]'),del=e.target.closest('[data-delete-food]');if(edit)openFoodEditor(edit.dataset.editFood);if(toggle){const list=getFoods(),f=list.find(x=>String(x.id)===toggle.dataset.toggleFood);if(f){f.available=f.available===false;saveData(KEYS.foods,list);renderFoodsAdmin();renderOverview()}}if(del&&confirm('Bạn có chắc muốn xóa món này?')){saveData(KEYS.foods,getFoods().filter(x=>String(x.id)!==del.dataset.deleteFood));renderFoodsAdmin();renderOverview();renderFoods()}};
}
function openFoodEditor(id=''){
 const form=$('#adminFoodForm');if(!form)return;form.reset();editingImage='';
 const f=id?getFoods().find(x=>String(x.id)===String(id)):null;
 $('#foodFormTitle').textContent=f?'Sửa món ăn':'Thêm món mới';
 form.elements.id.value=f?.id||'';form.elements.name.value=f?.name||'';form.elements.price.value=f?.price??'';form.elements.category.innerHTML=loadData(KEYS.categories,defaultCategories).map(c=>`<option>${safe(c)}</option>`).join('');form.elements.category.value=f?.category||loadData(KEYS.categories,defaultCategories)[0]||'Khác';form.elements.description.value=f?.description||'';form.elements.ingredients.value=f?.ingredients||'';form.elements.image.value=f?.image||'';form.elements.available.checked=f?.available!==false;form.elements.popular.checked=!!f?.popular;form.elements.newItem.checked=!!f?.newItem;editingImage=f?.image||'';renderImagePreview(editingImage);openModal('adminFoodModal');
}
function renderImagePreview(src){const el=$('#foodImagePreview');if(el)el.innerHTML=src?`<img src="${safe(src)}" alt="Xem trước món ăn">`:'Ảnh xem trước';}
function saveFoodForm(e){e.preventDefault();const form=e.currentTarget,fd=new FormData(form),name=String(fd.get('name')||'').trim(),price=Number(fd.get('price'));if(!name||!Number.isFinite(price)||price<0){toast('Vui lòng nhập tên và giá món hợp lệ','error');return}const foods=getFoods(),id=String(fd.get('id')||uid()),old=foods.find(x=>String(x.id)===id);const food={...(old||{}),id,name,price,category:String(fd.get('category')||'Khác'),description:String(fd.get('description')||''),ingredients:String(fd.get('ingredients')||''),image:editingImage||String(fd.get('image')||''),available:form.elements.available.checked,visible:true,popular:form.elements.popular.checked,newItem:form.elements.newItem.checked};const idx=foods.findIndex(x=>String(x.id)===id);if(idx>=0)foods[idx]=food;else foods.unshift(food);saveData(KEYS.foods,foods);closeModal('adminFoodModal');renderFoodsAdmin();renderOverview();renderFoods();toast('Đã lưu món ăn');}
function renderCategoriesAdmin(){const el=$('#categoryAdminList');if(!el)return;const cats=loadData(KEYS.categories,defaultCategories);el.innerHTML=cats.map(c=>`<div class="category-admin-item"><span>${safe(c)}</span><button class="small-action" data-delete-category="${safe(c)}">Xóa</button></div>`).join('');el.onclick=e=>{const b=e.target.closest('[data-delete-category]');if(!b)return;const name=b.dataset.deleteCategory;if(getFoods().some(f=>f.category===name)){toast('Danh mục đang có món ăn, hãy chuyển món sang danh mục khác trước','warning');return}saveData(KEYS.categories,cats.filter(c=>c!==name));renderCategoriesAdmin();$('#adminFoodCategory').innerHTML=loadData(KEYS.categories,defaultCategories).map(c=>`<option>${safe(c)}</option>`).join('')}}
function renderCouponsAdmin(){const el=$('#couponAdminList');if(!el)return;const coupons=loadData(KEYS.coupons,[]);el.innerHTML=coupons.length?coupons.map(c=>`<div class="category-admin-item"><span><b>${safe(c.code)}</b> · Giảm ${Number(c.percent)||0}% · Đơn tối thiểu ${money(c.minimum)}</span><button class="small-action" data-delete-coupon="${safe(c.code)}">Xóa</button></div>`).join(''):'<p class="muted">Chưa có mã khuyến mãi.</p>';el.onclick=e=>{const b=e.target.closest('[data-delete-coupon]');if(!b)return;saveData(KEYS.coupons,loadData(KEYS.coupons,[]).filter(c=>c.code!==b.dataset.deleteCoupon));renderCouponsAdmin()}}
async function renderReviewsAdmin(){const el=$('#reviewsList');if(!el)return;try{const data=await apiRequest('/api/admin/reviews');const reviews=Array.isArray(data.reviews)?data.reviews:[];el.innerHTML=reviews.length?reviews.map(r=>`<article class="panel"><b>${safe(r.customerName||'Khách hàng')}</b><p>${safe(r.text||'')}</p><small>Đơn ${safe(r.orderId||'')} · ${safe(r.rating||'')} ★ · ${dateLabel(r.createdAt)}</small></article>`).join(''):'<div class="empty-state">Chưa có đánh giá.</div>'}catch(e){el.innerHTML='<div class="empty-state">Không tải được đánh giá từ máy chủ. Hãy đăng nhập Admin và thử lại.</div>'}}
function renderSettingsAdmin(){const form=$('#settingsForm');if(!form)return;const s=getSettings();for(const key of ['name','phone','address','hours','deliveryFee','minimumOrder','tableCount','bankCode','bankAccount','bankAccountName'])if(form.elements[key]&&s[key]!==undefined)form.elements[key].value=s[key];for(const key of ['acceptingOrders','soundEnabled','bankTransferEnabled'])if(form.elements[key])form.elements[key].checked=!!s[key];if(s.bankQrImage){bankQrImage=s.bankQrImage;const preview=$('#bankQrPreview');if(preview)preview.innerHTML=`<img src="${safe(bankQrImage)}" alt="Ảnh QR">`}}
function renderAdmin(){
 if(document.body.dataset.page!=='admin'||$('#adminApp').classList.contains('hidden'))return;
 renderOverview();renderOrders();renderFoodsAdmin();renderCategoriesAdmin();renderCouponsAdmin();renderReviewsAdmin();renderSettingsAdmin();
 const orders=getOrders(),unread=loadData(KEYS.notifications,[]).filter(n=>!n.read).length;
 $('#newOrderBadge').textContent=orders.filter(o=>o.status==='Mới').length;$('#notificationCount').textContent=unread;
}
function renderOverview(){
 const orders=getOrders(),foods=getFoods(),today=new Date().toDateString();
 const todays=orders.filter(o=>new Date(o.createdAt).toDateString()===today);
 $('#statRevenue').textContent=money(todays.filter(o=>o.status==='Hoàn thành').reduce((s,o)=>s+o.total,0));
 $('#statOrders').textContent=todays.length;$('#statPending').textContent=orders.filter(o=>!['Hoàn thành','Đã hủy'].includes(o.status)).length;$('#statFoods').textContent=foods.filter(f=>f.available&&f.visible!==false).length;
 const recent=orders.slice(0,5);
 $('#recentOrders').innerHTML=recent.length?recent.map(o=>`<div class="mini-order"><div><b>${safe(o.id)} · ${safe(o.customerName)}</b><small>${dateLabel(o.createdAt)} · ${o.items.length} loại món</small></div><div style="text-align:right">${statusPill(o.status)}<small>${money(o.total)}</small></div></div>`).join(''):'<div class="empty-state">Chưa có đơn hàng. Đơn mới sẽ xuất hiện tại đây.</div>';
 const sold={};orders.filter(o=>o.status==='Hoàn thành').forEach(o=>o.items.forEach(it=>sold[it.foodId]=(sold[it.foodId]||0)+it.qty));
 const top=foods.map(f=>({...f,actualSold:sold[f.id]||0})).sort((a,b)=>b.actualSold-a.actualSold).slice(0,5);
 $('#topFoods').innerHTML=top.length?top.map(f=>`<div class="top-food-row">${img(f.image,f.name)}<div><b>${safe(f.name)}</b><small>${safe(f.category)}</small></div><strong>${f.actualSold} phần</strong></div>`).join(''):'<p class="muted">Chưa có dữ liệu.</p>';
}
function renderOrders(){
 const list=$('#ordersList');if(!list)return;
 const q=($('#orderSearch')?.value||'').toLowerCase().trim(),status=$('#orderStatusFilter')?.value||'';
 const orders=getOrders().filter(o=>(!status||o.status===status)&&(!q||[o.id,o.customerName,o.phone].join(' ').toLowerCase().includes(q)));
 list.innerHTML=orders.length?orders.map(o=>`<article class="order-card"><div class="order-card-top"><div><h3>${safe(o.id)} ${statusPill(o.status)}</h3><p>${dateLabel(o.createdAt)} · ${safe(o.customerName)} · ${safe(o.phone)}</p></div><div class="order-card-total">${money(o.total)}</div></div><div class="order-card-details"><span>🍽 ${o.items.reduce((s,it)=>s+it.qty,0)} phần · ${safe(o.items.map(it=>it.name+' ×'+it.qty).join(', '))}</span><span>📍 ${safe(o.fulfillment==='pickup'?'Nhận tại quán · '+(o.table?'Bàn '+o.table:''):o.address)}</span><span>💳 ${safe(o.payment)}</span>${o.note?`<span>📝 ${safe(o.note)}</span>`:''}</div><div class="order-card-actions"><label style="font-size:10px;color:var(--muted)">Trạng thái</label><select data-order-status="${safe(o.id)}">${statusOptions.map(s=>`<option ${o.status===s?'selected':''}>${s}</option>`).join('')}</select><button class="small-action" data-order-detail="${safe(o.id)}">Chi tiết</button>${o.status==='Mới'?`<button class="btn btn-primary" style="padding:8px 12px;font-size:10px" data-confirm-order="${safe(o.id)}">Xác nhận đơn</button>`:''}</div><div class="hidden" id="order-detail-${safe(o.id)}" style="padding:13px 0 0;font-size:11px"><b>Chi tiết món</b><ul>${o.items.map(it=>`<li>${safe(it.name)} × ${it.qty} — ${money(it.price*it.qty)}${it.note?' · '+safe(it.note):''}</li>`).join('')}</ul><p>Khách: ${safe(o.customerName)} | ${safe(o.phone)} | ${safe(o.address)}</p><p>Tạm tính ${money(o.subtotal)} · Phí ${money(o.deliveryFee)} · Giảm ${money(o.discount)} · Tổng ${money(o.total)}</p></div></article>`).join(''):'<div class="empty-state">Không có đơn hàng phù hợp.</div>';
 list.onchange=e=>{const sel=e.target.closest('[data-order-status]');if(sel)updateOrderStatus(sel.dataset.orderStatus,sel.value)};
 list.onclick=e=>{const detail=e.target.closest('[data-order-detail]');const confirm=e.target.closest('[data-confirm-order]');if(detail)$(`#order-detail-${CSS.escape(detail.dataset.orderDetail)}`)?.classList.toggle('hidden');if(confirm)updateOrderStatus(confirm.dataset.confirmOrder,'Đã xác nhận')};
}
async function updateOrderStatus(id,status){
 try{const result=await apiRequest('/api/admin/orders/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({status})});const orders=getOrders(),idx=orders.findIndex(x=>x.id===id);if(idx>=0)orders[idx]=result.order;else orders.unshift(result.order);saveData(KEYS.orders,orders);if(status==='Hoàn thành'){const foods=getFoods();const o=result.order;o.items.forEach(it=>{const f=foods.find(x=>x.id===it.foodId);if(f)f.sold=Number(f.sold||0)+Number(it.qty||0)});saveData(KEYS.foods,foods)}toast('Đã cập nhật trạng thái đơn');renderAdmin()}catch(err){toast('Không cập nhật được đơn trên máy chủ: '+err.message,'error')}
}
function initAdmin(){
 adminLogin();
 $('#themeToggle')?.remove();
 $('#adminThemeToggle').onclick=toggleTheme;
 $$('.side-link[data-view]').forEach(b=>b.onclick=()=>showAdminView(b.dataset.view));
 $$('[data-goto]').forEach(b=>b.onclick=()=>showAdminView(b.dataset.goto));
 $('#adminMenuToggle').onclick=()=>$('#adminSidebar').classList.toggle('open');
 $('#logoutBtn').onclick=async()=>{try{await apiRequest('/api/admin/logout',{method:'POST',body:'{}'})}catch(e){}location.reload()};
 $('#orderSearch').addEventListener('input',renderOrders);$('#orderStatusFilter').onchange=renderOrders;$('#foodAdminSearch').addEventListener('input',renderFoodsAdmin);
 $('#addFoodBtn').onclick=()=>openFoodEditor();$('#adminFoodForm').onsubmit=saveFoodForm;
 $('#foodImageFile').onchange=e=>{const file=e.target.files?.[0];if(!file)return;if(!file.type.startsWith('image/')){toast('Vui lòng chọn file ảnh','warning');return}if(file.size>1024*1024){toast('Ảnh quá lớn. Hãy chọn ảnh dưới 1 MB.','warning');e.target.value='';return}const reader=new FileReader();reader.onload=()=>{editingImage=String(reader.result);$('#adminFoodForm').elements.image.value='';renderImagePreview(editingImage)};reader.onerror=()=>toast('Không đọc được ảnh','error');reader.readAsDataURL(file)};
 $('#adminFoodForm').elements.image.addEventListener('input',e=>{if(e.target.value.trim()){editingImage=e.target.value.trim();renderImagePreview(editingImage)}});
 $('#categoryForm').onsubmit=e=>{e.preventDefault();const input=e.currentTarget.elements.category,c=input.value.trim(),cats=loadData(KEYS.categories,defaultCategories);if(cats.some(x=>x.toLowerCase()===c.toLowerCase())){toast('Danh mục đã tồn tại','warning');return}cats.push(c);saveData(KEYS.categories,cats);input.value='';renderCategoriesAdmin();toast('Đã thêm danh mục')};
 $('#couponForm').onsubmit=e=>{e.preventDefault();const fd=new FormData(e.currentTarget),code=String(fd.get('code')).trim().toUpperCase(),cs=loadData(KEYS.coupons,[]);if(cs.some(c=>c.code===code)){toast('Mã này đã tồn tại','warning');return}cs.push({code,percent:Number(fd.get('percent')),minimum:Number(fd.get('minimum')||0),active:true});saveData(KEYS.coupons,cs);e.currentTarget.reset();renderCouponsAdmin();toast('Đã tạo mã khuyến mãi')};
 $('#adminCredentialsForm').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,fd=new FormData(form),newPhone=normalizeAdminPhone(fd.get('newPhone')),currentPassword=String(fd.get('currentPassword')||''),newPassword=String(fd.get('newPassword')||''),confirmPassword=String(fd.get('confirmPassword')||'');if(newPhone.replace(/\D/g,'').length<9){toast('Số điện thoại mới chưa hợp lệ','error');return}if(Boolean(newPassword)!==Boolean(confirmPassword)){toast('Hãy nhập cả hai ô mật khẩu mới hoặc để trống cả hai','error');return}if(newPassword&&(newPassword.length<12||newPassword!==confirmPassword)){toast(newPassword.length<12?'Mật khẩu mới cần ít nhất 12 ký tự':'Mật khẩu mới không khớp','error');return}try{const result=await apiRequest('/api/admin/credentials',{method:'PATCH',body:JSON.stringify({currentPassword,newPhone,newPassword})});form.reset();$('#currentAdminPhone').value=result.phone;toast('Đã cập nhật thông tin đăng nhập Admin')}catch(err){toast(err.message||'Không đổi được thông tin','error')}};
 $('#settingsForm').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,old=getSettings(),tableCount=Number(f.elements.tableCount.value);if(!Number.isInteger(tableCount)||tableCount<1||tableCount>200){toast('Số bàn phải là số nguyên từ 1 đến 200','warning');return}if(f.elements.bankTransferEnabled.checked&&(!f.elements.bankAccount.value.trim()||!f.elements.bankAccountName.value.trim())){toast('Nhập số tài khoản và tên chủ tài khoản để bật chuyển khoản','warning');return}const settings={...old,name:f.elements.name.value.trim(),phone:f.elements.phone.value.trim(),address:f.elements.address.value.trim(),hours:f.elements.hours.value.trim(),deliveryFee:Number(f.elements.deliveryFee.value||0),minimumOrder:Number(f.elements.minimumOrder.value||0),tableCount,acceptingOrders:f.elements.acceptingOrders.checked,soundEnabled:f.elements.soundEnabled.checked,bankTransferEnabled:f.elements.bankTransferEnabled.checked,bankCode:f.elements.bankCode.value,bankAccount:f.elements.bankAccount.value.trim(),bankAccountName:f.elements.bankAccountName.value.trim(),bankQrImage};try{const result=await apiRequest('/api/admin/settings',{method:'PATCH',body:JSON.stringify(settings)});saveData(KEYS.settings,result.settings||settings);saveData(KEYS.tables,Array.from({length:tableCount},(_,i)=>({id:i+1,name:'Bàn '+String(i+1).padStart(2,'0'),status:'Trống'})));toast('Đã lưu cài đặt nhà hàng và số bàn lên máy chủ')}catch(err){toast('Không lưu được cài đặt lên máy chủ: '+err.message,'error')}};
 $('#bankQrFile').onchange=e=>{const file=e.target.files?.[0];if(!file)return;if(!file.type.startsWith('image/')){toast('Vui lòng chọn ảnh QR','warning');e.target.value='';return}if(file.size>700*1024){toast('Ảnh QR phải nhỏ hơn 700 KB','warning');e.target.value='';return}const reader=new FileReader();reader.onload=()=>{bankQrImage=String(reader.result);$('#bankQrPreview').innerHTML=`<img src="${safe(bankQrImage)}" alt="Ảnh QR xem trước">`;toast('Đã tải ảnh QR lên. Nhấn Lưu cài đặt để lưu')};reader.onerror=()=>toast('Không đọc được ảnh QR','error');reader.readAsDataURL(file)};
 $('#notificationBtn').onclick=()=>{const notes=loadData(KEYS.notifications,[]);if('Notification' in window&&Notification.permission==='default')enableOrderNotifications();if(!notes.length){toast('Chưa có thông báo');return}const unread=notes.filter(n=>!n.read);const summary=unread.slice(0,5).map(n=>n.message).join(' · ');toast(summary||'Không có thông báo chưa đọc');markNotificationsRead()};
 $('#exportDataBtn').onclick=()=>{const data={};Object.values(KEYS).filter(k=>k!==KEYS.session).forEach(k=>{try{data[k]=JSON.parse(localStorage.getItem(k)||'null')}catch(e){data[k]=null}});const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='quan-ngon-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(url);toast('Đã xuất bản sao lưu')};
 $('#importDataFile').onchange=e=>{const file=e.target.files?.[0];if(!file)return;if(!confirm('Khôi phục sẽ ghi đè dữ liệu hiện có. Bạn có chắc không?')){e.target.value='';return}const reader=new FileReader();reader.onload=()=>{try{const data=JSON.parse(reader.result);Object.values(KEYS).filter(k=>k!==KEYS.session).forEach(k=>{if(Object.prototype.hasOwnProperty.call(data,k))localStorage.setItem(k,JSON.stringify(data[k]))});toast('Khôi phục dữ liệu thành công');renderAdmin()}catch(err){toast('File JSON không hợp lệ','error')}e.target.value=''};reader.readAsText(file)};

}

function init(){
 try { localStorage.removeItem('restaurant_driver_profile_v2'); sessionStorage.removeItem('restaurant_order_alert_seen_v2'); const legacyOrders=loadData(KEYS.orders,[]); let cleaned=false; const driverFields=['driverName','driverPhone','driverAge','driverPlate','driverVehicleType','driverPhoto','driverLat','driverLng','driverLocationUpdatedAt']; legacyOrders.forEach(o=>driverFields.forEach(k=>{if(Object.prototype.hasOwnProperty.call(o,k)){delete o[k];cleaned=true}})); if(cleaned)localStorage.setItem(KEYS.orders,JSON.stringify(legacyOrders)); const oldNotes=loadData(KEYS.notifications,[]); let notesChanged=false; oldNotes.forEach(n=>{if(Array.isArray(n.for)){const next=n.for.filter(x=>x!=='driver');if(next.length!==n.for.length){n.for=next;notesChanged=true}}}); if(notesChanged)localStorage.setItem(KEYS.notifications,JSON.stringify(oldNotes)); } catch(e) {}
 initTheme();ensureDefaults();
 if(document.body.dataset.page==='customer'){initCustomer();apiRequest('/api/settings').then(({settings})=>{if(settings&&typeof settings==='object'){saveData(KEYS.settings,{...getSettings(),...settings});saveData(KEYS.tables,Array.from({length:Math.max(1,Math.min(200,Number(settings.tableCount)||20))},(_,i)=>({id:i+1,name:'Bàn '+String(i+1).padStart(2,'0'),status:'Trống'})));const tableSel=$('[name="table"]');if(tableSel){const current=tableSel.value;tableSel.innerHTML='<option value="">Chọn bàn</option>'+loadData(KEYS.tables,[]).map(t=>`<option value="${t.id}">${safe(t.name)}</option>`).join('');if(current)tableSel.value=current}}}).catch(err=>console.warn('Không tải được cài đặt nhà hàng:',err.message))}
 if(document.body.dataset.page==='admin'){initAdmin();setInterval(()=>refreshOrdersFromServer(),5000);apiRequest('/api/settings').then(({settings})=>{if(settings&&typeof settings==='object'){saveData(KEYS.settings,{...getSettings(),...settings});renderSettingsAdmin()}}).catch(err=>console.warn('Không tải được cài đặt máy chủ:',err.message))}
}
init();
})();
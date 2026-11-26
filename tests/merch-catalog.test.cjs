const {test}=require("node:test"); const assert=require("node:assert/strict"); const fs=require("node:fs"); const ts=require("typescript");
function actions(db) {
 const mod={exports:{}};
 const code=ts.transpileModule(fs.readFileSync("app/admin/merchandise/actions.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const imports={"@/lib/supabase/server":{createClient:async()=>db},"next/navigation":{redirect(p){throw Error("REDIRECT:"+p)}},"next/cache":{revalidatePath(){}}};
 new Function("exports","require","module",code)(mod.exports,n=>imports[n],mod); return mod.exports;
}
function form(extra={}){const f=new FormData();for(const[k,v]of Object.entries({name:"Shirt",price:"20.00",unit_cost:"8.00",active:"on",image_url:"/images/shirt.jpg",...extra}))f.set(k,v);return f;}
const auth={getUser:async()=>({data:{user:{id:"admin"}}})};
test("catalog creation and updates use current product prices/costs only",async()=>{
 for(const id of ["","product-1"]){let saved;let filtered;
 const chain={eq(k,v){filtered=v;return this},select(){return this},single:async()=>({data:{id:"product-1"},error:null})};
 const db={auth,from(table){assert.equal(table,"merch_products");return{insert(v){assert.equal(id,"");saved=v;return chain},update(v){assert.ok(id);saved=v;return chain}}}};
 await assert.rejects(actions(db).saveMerchProduct(form({product_id:id})),/saved=product/);
 assert.equal(saved.price,20);assert.equal(saved.unit_cost,8);assert.equal(saved.active,true);if(id)assert.equal(filtered,id);
 }
});
test("bad amounts and unsafe image URLs never write",async()=>{
 const db={auth,from(){assert.fail("No invalid write")}};
 for(const extra of [{price:"-1"},{unit_cost:"NaN"},{price:"1.234"},{image_url:"javascript:alert(1)"},{image_url:"//evil.example/img"},{name:""}])
 await assert.rejects(actions(db).saveMerchProduct(form(extra)),/\?error=/);
});
test("archiving hides a product instead of deleting history and authentication is enforced",async()=>{
 let saved; const chain={eq(){return this},select(){return this},single:async()=>({data:{id:"p"},error:null})};
 const db={auth,from(table){assert.equal(table,"merch_products");return{update(v){saved=v;return chain}}}};
 await assert.rejects(actions(db).archiveMerchProduct(form({product_id:"p"})),/saved=archived/);assert.deepEqual(saved,{active:false});
 const denied={auth:{getUser:async()=>({data:{user:null}})},from(){assert.fail("No anonymous writes")}};
 await assert.rejects(actions(denied).saveMerchProduct(form()),/admin\/login/);
 await assert.rejects(actions(denied).archiveMerchProduct(form()),/admin\/login/);
});

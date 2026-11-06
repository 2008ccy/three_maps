import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

// Exercise the hosted WorkBuddy RPC schema rather than the legacy event-function
// adapter. Everything runs inside an ephemeral local PostgreSQL engine.
const migration=await readFile(new URL('../sql/002-workbuddy-cloud.sql',import.meta.url),'utf8');
const targetMigration=await readFile(new URL('../sql/003-workbuddy-targets.sql',import.meta.url),'utf8');
const manifest=JSON.parse(await readFile(new URL('../data/targets.json',import.meta.url),'utf8'));
const args=(key=randomUUID(),content='请补充这个判断的适用条件。')=>[key,'domain','rag','内容错误',content,null,null];
async function fixture(t){
 const db=new PGlite();t.after(()=>db.close());
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');await db.exec(migration);await db.exec(targetMigration);
 const rpc=async(name,values)=>(await db.query(`SELECT public.${name}(${values.map((_,i)=>'$'+(i+1)).join(',')}) AS data`,values)).rows[0].data;
 return {db,rpc,submit:(values=args())=>rpc('submit_feedback',values)};
}

test('hosted RPC creates a stable public record and denies direct visitor table operations',async t=>{
 const {db,submit,rpc}=await fixture(t);await db.exec('SET ROLE anon');const item=await submit();
 assert.match(item.id,/^FB-[0-9a-f-]{36}$/);assert.equal(item.status,'待核实');assert.deepEqual(item.target,{mapId:'domain',nodeId:'rag'});assert.ok(Number.isFinite(Date.parse(item.createdAt)));
 for(const field of ['internal_notes','request_key','request_hash','is_public'])assert.equal(field in item,false);
 assert.deepEqual(await rpc('get_feedback',[item.id]),item);
 for(const sql of ['SELECT * FROM public.feedback','SELECT * FROM public.feedback_targets',"UPDATE public.feedback SET status='已完成'",'DELETE FROM public.feedback',"INSERT INTO public.feedback(map_id,type,content) VALUES ('domain','内容错误','这条记录不应能绕过接口')"])
  await assert.rejects(db.query(sql),{code:'42501'});
});

test('hosted RPC preserves idempotency, payload conflicts and hidden-record privacy',async t=>{
 const {db,submit,rpc}=await fixture(t),values=args();const first=await submit(values),replay=await submit(values);assert.equal(replay.id,first.id);assert.equal((await db.query('SELECT count(*)::int AS n FROM public.feedback')).rows[0].n,1);
 const changed=[...values];changed[4]='这是相同请求键的不同内容。';await assert.rejects(submit(changed),{code:'23505'});
 await db.query('UPDATE public.feedback SET is_public=false WHERE id=$1',[first.id]);assert.equal(await rpc('get_feedback',[first.id]),null);await assert.rejects(submit(values),{code:'P0002'});
});

test('hosted RPC enforces enums, Unicode lengths and URL protocol',async t=>{
 const {submit,rpc}=await fixture(t);
 for(const [index,value] of [[0,'bad-key'],[1,'unknown-map'],[2,'BAD NODE'],[3,'伪造状态'],[4,'短'],[4,'字'.repeat(1001)],[5,'名'.repeat(21)],[6,'javascript:alert(1)']]){const values=args();values[index]=value;await assert.rejects(submit(values),{code:'22023'});}
 const emoji=args();emoji[4]='😀'.repeat(1000);const item=await submit(emoji);assert.equal(Array.from(item.content).length,1000);await assert.rejects(rpc('get_feedback',['not-an-id']),{code:'22023'});
});

test('hosted RPC paginates equal timestamps, filters, and projects public admin replies',async t=>{
 const {db,submit,rpc}=await fixture(t);for(let i=0;i<23;i++)await submit(args(randomUUID(),`本地 SQL 验收记录 ${i}，不创建真实反馈。`));
 await db.exec("UPDATE public.feedback SET created_at='2026-11-06T00:00:00.123456Z'");
 const first=await rpc('list_feedback',['domain',null,null,null,20]);assert.equal(first.items.length,20);assert.ok(first.nextCursor);
 const next=await rpc('list_feedback',['domain',null,null,first.nextCursor,20]);assert.equal(next.items.length,3);assert.equal(next.nextCursor,null);assert.equal(new Set([...first.items,...next.items].map(i=>i.id)).size,23);
 const id=first.items[0].id;await db.query("UPDATE public.feedback SET status='已完成',reply='本地管理员回复',resolution='已核对',release_version='v1.4',internal_notes='never public' WHERE id=$1",[id]);
 const done=await rpc('list_feedback',[null,null,'已完成',null,20]);assert.equal(done.items.length,1);assert.equal(done.items[0].reply,'本地管理员回复');assert.equal('internal_notes' in done.items[0],false);
 await db.query('UPDATE public.feedback SET is_public=false WHERE id=$1',[id]);assert.equal((await rpc('list_feedback',[null,null,'已完成',null,20])).items.length,0);
 await assert.rejects(rpc('list_feedback',['bad-map',null,null,null,20]),{code:'22023'});await assert.rejects(rpc('list_feedback',[null,null,null,'invalid-cursor',20]),{code:'22023'});
});

test('hosted target migration matches active maps, rejects retired and wrong-map nodes, and preserves history',async t=>{
 const {db,submit,rpc}=await fixture(t);await db.exec(targetMigration);
 const targets=(await db.query('SELECT map_id,node_id FROM public.feedback_targets WHERE is_active ORDER BY map_id,node_id')).rows;
 const expected=manifest.maps.flatMap(m=>[{map_id:m.id,node_id:''},...m.nodes.map(n=>({map_id:m.id,node_id:n.id}))]).sort((a,b)=>a.map_id.localeCompare(b.map_id)||a.node_id.localeCompare(b.node_id));
 assert.deepEqual(targets,expected);
 for(const [map,node] of [['domain','missing-node'],['cognition','independent-feedback'],['ecosystem','rag']]){const values=args();values[1]=map;values[2]=node;await assert.rejects(submit(values),{code:'22023'});}
 const existing=await submit();await db.query("UPDATE public.feedback_targets SET is_active=false WHERE map_id='domain' AND node_id='rag'");
 await assert.rejects(submit(),{code:'22023'});assert.equal((await rpc('get_feedback',[existing.id])).id,existing.id);
});


test('hosted submission guard rejects credential and whitespace URLs while retaining encoded public links',async t=>{
 const {submit}=await fixture(t);
 for(const url of ['https://user:pass@example.test/path','https://example.test/with space','https://exa mple.test/path','https://example.test/line\nfeed','https://example.test/tab\there']){const values=args();values[6]=url;await assert.rejects(submit(values),{code:'22023'});}
 for(const url of ['https://example.test/with%20space','http://example.test/a?email=a@b.test#ref','https://[::1]/']){const values=args();values[6]=url;assert.equal((await submit(values)).referenceUrl,url);}
});

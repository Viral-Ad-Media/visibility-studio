import {it,expect,vi,beforeEach} from 'vitest';
const state=vi.hoisted(()=>({attempts:1,spent:5,run:vi.fn(),research:vi.fn()}));
vi.mock('../lib/db',()=>{
 const db:any={prepare:(sql:string)=>({all:async()=>[],get:async()=>{
 if(sql.includes('vis_claim_job_v2')) return {id:4,account_id:2,type:'audit_business',attempts:state.attempts,status:'running',payload:'{"audit_id":1,"name":"Business"}'};
 if(sql.includes('AS spent')) return {spent:state.spent};
 if(sql.includes('SELECT status, attempts')) return {status:'running',attempts:state.attempts};
 if(sql.includes('COUNT(*)')) return {n:1};
 throw new Error('Unexpected test query: '+sql);
 },run:state.run}),transaction:async(fn:any)=>fn(db)};
 return {serviceDb:db};
});
vi.mock('../lib/engine/auditBusiness',()=>({runAuditBusiness:state.research}));
import {runWorkerLoop} from '../lib/engine/worker';
beforeEach(()=>{state.attempts=1;state.spent=5;state.run.mockReset();state.research.mockReset();});
it('stops additional provider research at the per-audit completed-usage budget',async()=>{
 expect(await runWorkerLoop()).toEqual({processed:0});
 expect(state.research).not.toHaveBeenCalled();
 expect(state.run.mock.calls[0][0]).toContain('budget reached');
});
it('does not call the provider when an exhausted job lease is reclaimed',async()=>{
 state.attempts=3;state.spent=0;
 expect(await runWorkerLoop()).toEqual({processed:0});
 expect(state.research).not.toHaveBeenCalled();
 expect(state.run.mock.calls[0][0]).toContain('retry limit');
});

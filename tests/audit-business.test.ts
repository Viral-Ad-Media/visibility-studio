import {it,expect,vi,afterEach} from 'vitest';
const create=vi.hoisted(()=>vi.fn());
vi.mock('../lib/engine/anthropic',()=>({getAnthropic:()=>({messages:{create}}),ENGINE_MODEL:'fixture',RESEARCH_TOOLS:[{type:'web_search_20260318',name:'web_search',max_uses:8},{type:'web_fetch_20260318',name:'web_fetch',max_uses:8}],countSearchCalls:()=>1,estimateCost:()=>0.1,SEARCH_CALL_COST_USD:0.01}));
vi.mock('../lib/db',()=>({serviceDb:{prepare:()=>({get:async()=>({category:'dentist',location:'Boston'})})}}));
import {runAuditBusiness} from '../lib/engine/auditBusiness';
afterEach(()=>create.mockReset());
it('limits research duration and preserves fetched evidence when submission omits sources',async()=>{
 create.mockResolvedValueOnce({content:[{type:'web_fetch_tool_result',content:{type:'web_fetch_result',url:'https://business.example/contact'}}],usage:{}}).mockResolvedValueOnce({content:[{type:'tool_use',name:'submit_business',input:{name:'Business',priority:'Medium'}}],usage:{}});
 const result=await runAuditBusiness({audit_id:1,name:'Business'});
 expect(JSON.parse(result.meta.source_urls_json as string)).toEqual(['https://business.example/contact']);
 expect(create.mock.calls[0][1]).toEqual({timeout:200000});
 expect(create.mock.calls[0][0].tools.map((t:{max_uses:number})=>t.max_uses)).toEqual([3,3]);
 expect(create.mock.calls[1][1]).toEqual({timeout:40000});
 expect(create.mock.calls[1][0].tools.map((t:{name:string})=>t.name)).toEqual(['submit_business']);
});
it('fails rather than fabricating evidence when neither research nor submission has URLs',async()=>{
 create.mockResolvedValueOnce({content:[],usage:{}}).mockResolvedValueOnce({content:[{type:'tool_use',name:'submit_business',input:{name:'Business'}}],usage:{}});
 await expect(runAuditBusiness({audit_id:1,name:'Business'})).rejects.toThrow();
});

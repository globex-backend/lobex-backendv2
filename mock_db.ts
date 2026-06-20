// In-memory mock. Supports insert / select / eq / gte / gt / contains chains. Offline.
export function mockDb(seed: Record<string, any[]> = {}) {
  const tables: Record<string, any[]> = JSON.parse(JSON.stringify(seed));
  function query(name: string) {
    let rows = [...(tables[name] ??= [])];
    const api: any = {
      select() { return api; },
      eq(k: string, v: any)  { rows = rows.filter(r => r[k] === v); return api; },
      gt(k: string, v: any)  { rows = rows.filter(r => new Date(r[k]) >  new Date(v)); return api; },
      gte(k: string, v: any) { rows = rows.filter(r => new Date(r[k]) >= new Date(v)); return api; },
      contains(k: string, obj: any) {
        rows = rows.filter(r => Object.entries(obj).every(([kk,vv]) => (r[k]??{})[kk] === vv)); return api; },
      limit(n: number) { rows = rows.slice(0, n); return api; },
      update(patch: any) { return { eq(k:string,v:any){ return { eq(k2:string,v2:any){
        (tables[name]).forEach(r=>{ if(r[k]===v&&r[k2]===v2) Object.assign(r,patch); }); return {error:null}; },
        then:undefined }; } }; },
      insert(row: any) {
        const arr = Array.isArray(row) ? row : [row];
        // emulate unique open-insight index for dedup test
        if (name === "insight") {
          for (const r of arr) {
            const dup = tables.insight.some(x => x.entity_id===r.entity_id && x.rule_key===r.rule_key && (x.status??"open")==="open");
            if (dup) return { error: { code:"23505" }, data:null };
          }
        }
        arr.forEach(r => tables[name].push({ status:"open", created_at:new Date().toISOString(), ...r }));
        return { error: null, data: arr };
      },
      then(res: any) { return res({ data: rows, error: null }); },
    };
    return api;
  }
  return { from: (n: string) => query(n), _tables: tables };
}

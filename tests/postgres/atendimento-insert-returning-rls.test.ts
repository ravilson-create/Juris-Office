import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const dir=join(process.cwd(),"db/migrations");
const hashA="a".repeat(64);
const hashB="b".repeat(64);
const area="11111111-1111-4111-8111-111111111111";
const SQL = `INSERT INTO legal_cases
  (id,protocol,legal_area_id,owner_session_hash,citizen_id,status,created_at,updated_at)
  VALUES ($1,$2,$3,$4,$5,'draft',now(),now())
  RETURNING id,protocol,legal_area_id,owner_session_hash,citizen_id,status`;

async function seedSchema(db:PGlite,includeFix:boolean){
  for(const f of readdirSync(dir).filter(f=>/^\d+_.*\.sql$/.test(f)).sort()) {
    if(!includeFix && f==="0041_corrige_criacao_atendimento_rls.sql")continue;
    await db.exec(readFileSync(join(dir,f),"utf8"));
  }
  await db.exec(`CREATE ROLE case_insert_test;
    GRANT SELECT,INSERT,UPDATE ON legal_cases TO case_insert_test;
    SET ROLE case_insert_test`);
  await db.query("SELECT set_config('app.user_id','',false)");
  await db.query("SELECT set_config('app.anon_hash',$1,false)",[hashA]);
}

describe("regressão: escolha da área deve criar o atendimento no Neon com RETURNING",()=>{
  it("reproduz a falha anterior ao ajuste da política de leitura",async()=>{
    const db=new PGlite();
    try{
      await seedSchema(db,false);
      await expect(db.query(SQL,[randomUUID(),"JO-ANTES-RLS",area,hashA,null]))
        .rejects.toThrow(/row.level.security/i);
    }finally{await db.close();}
  },30000);

  it("permite INSERT RETURNING do próprio cidadão anônimo, sem expor os de terceiros",async()=>{
    const db=new PGlite();
    try{
      await seedSchema(db,true);
      const id=randomUUID();
      const result=await db.query(SQL,[id,"JO-ANON-RLS",area,hashA,null]);
      expect(result.rows).toMatchObject([{id,owner_session_hash:hashA,citizen_id:null}]);
      await db.query("SELECT set_config('app.anon_hash',$1,false)",[hashB]);
      expect((await db.query("SELECT id FROM legal_cases")).rows).toHaveLength(0);
      await expect(db.query(SQL,[randomUUID(),"JO-CROSS-RLS",area,hashA,null]))
        .rejects.toThrow(/row.level.security/i);
      expect((await db.query("SELECT id FROM legal_cases")).rows).toHaveLength(0);
    }finally{await db.close();}
  },30000);

  it("permite INSERT RETURNING do próprio cidadão autenticado; bloqueia outro usuário",async()=>{
    const db=new PGlite();
    try{
      await seedSchema(db,true);
      await db.query("SELECT set_config('app.user_id','citizen-alpha',false)");
      const id=randomUUID();
      const result=await db.query(SQL,[id,"JO-LOGIN-RLS",area,null,"citizen-alpha"]);
      expect(result.rows).toMatchObject([{id,citizen_id:"citizen-alpha"}]);
      await db.query("SELECT set_config('app.user_id','citizen-beta',false)");
      expect((await db.query("SELECT id FROM legal_cases")).rows).toHaveLength(0);
      await expect(db.query(SQL,[randomUUID(),"JO-ALHEIO-RLS",area,null,"citizen-alpha"]))
        .rejects.toThrow(/row.level.security/i);
    }finally{await db.close();}
  },30000);
});

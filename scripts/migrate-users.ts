import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, key, { auth: { persistSession: false } });

const TEMP_PASSWORD = "ChangeMe!" + Math.random().toString(36).slice(2, 10) + "Aa1";

const users = [
  ["5a038b73-f8ea-4c47-bfa0-01ecef97da7a","webersera@outlook.com","Admin",null],
  ["3cda2a6c-d1bb-4bd7-9366-368a4eaf6428","janardanprasad1982bug@gmail.com","Rahul",""],
  ["54d161b8-ffcb-413e-a86b-4b9060fcbc12","ram822j@gmail.com","Harsh",""],
  ["63bacc15-694c-44da-9bf4-39631e6c0118","bestm4254@gmail.com","Ggggggjsdhj","Vhjrrty875556"],
  ["1fba3f47-8cce-46a4-b036-8975467fe072","shindesweety1617@gmail.com","Sweety shinde","9307972592"],
  ["80769e37-7683-4838-90a3-987c8c5fad48","sumanarender23@gmail.com","SumaNarender","9390233778"],
  ["53fc206e-7e07-4025-ae3e-892d4fd59e8f","sujanhalder745@gmail.com","Sujan haldar","08101661750"],
  ["0d0ac2ee-6fa7-45f0-855c-3b8f57f2a0c8","lilawatik568@gmail.com","Lilawati Kumari","6238680135"],
  ["da1d9531-46ca-4b0f-8c42-ca55612f0229","sonalijain0808@gmail.com","Sonali jain","07428144071"],
  ["1c4b5011-f986-408c-838a-0ad39e96a9bb","sr8097964@gmail.com","Simran Rani","7607613983"],
  ["3a9e5ae8-8180-4f45-a9df-c4a54f0385e6","srikreshma1@gmail.com","Reshma Sri K",""],
  ["6e4d5891-3c6f-4280-b974-1355e1da7ab5","yogeswari.chandrasekar@gmail.com","yogeswari","9042809220"],
  ["f8a6983c-4341-4d86-b854-8fa92ac60454","biswajitsahoo777777@gmail.com","Biswajit sahoo",""],
  ["2279d581-7bd8-4ea2-b326-61f33a43f6df","nationdata7@gmail.com","RAJU SINGH",""],
  ["ce4d54b6-a1e3-4d52-b899-dd32c525523a","navinverama007@gmail.com","Tanmay verma","9120973062"],
  ["ccd7f3d8-6fca-4f7a-a400-c7701af0ba86","artichaudharychaudhary32286@gmail.com","Arti kumari","7542057220"],
] as const;

console.log("Temp password for all migrated users:", TEMP_PASSWORD);

let created = 0, existed = 0, failed = 0;
for (const [id, email, full_name, phone] of users) {
  // Check if profile already exists (proxy for auth user existing)
  const { data: prof } = await admin.from("profiles").select("id").eq("id", id).maybeSingle();
  if (prof) { existed++; console.log("SKIP exists:", email); continue; }

  const { error } = await admin.auth.admin.createUser({
    id: id as string,
    email: email as string,
    password: TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name, phone: phone ?? "" },
  } as any);
  if (error) {
    failed++;
    console.error("FAIL", email, error.message);
  } else {
    created++;
    console.log("OK", email);
  }
}
console.log({ created, existed, failed, total: users.length });

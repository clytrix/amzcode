// Server functions for the project-management module: projects, modules,
// tasks lifecycle, comments, time tracking, and the credential vault.
//
// All admin-write operations validate `has_role('admin')`. Client code
// passes the user's JWT via the requireSupabaseAuth middleware.

import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { encryptSecret, decryptSecret } from "@/server/crypto";
import { sendTemplatedEmail, buildDashboardUrl } from "@/server/email-templates";

// ---------- helpers ----------

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

async function recordActivity(taskId: string, actorId: string | null, kind: string, payload: Record<string, unknown> = {}) {
  await supabaseAdmin.from("task_activity").insert({
    task_id: taskId, actor_id: actorId, kind, payload: payload as never,
  } as never);
}

function buildProjectUrl(projectId: string): string {
  const base = process.env.PUBLIC_SITE_URL || "https://amzsolution.site";
  return `${base.replace(/\/$/, "")}/dashboard/projects/${projectId}`;
}
function buildTaskUrl(taskId: string): string {
  const base = process.env.PUBLIC_SITE_URL || "https://amzsolution.site";
  return `${base.replace(/\/$/, "")}/dashboard/tasks/${taskId}`;
}

// ============================================================
// PROJECTS
// ============================================================

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(5000).optional().nullable(),
      status: z.enum(["planning", "active", "on_hold", "completed", "archived"]).default("planning"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("projects")
      .insert({
        title: data.title,
        description: data.description ?? null,
        status: data.status,
        owner_id: context.userId,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const updateProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(5000).nullable().optional(),
      status: z.enum(["planning", "active", "on_hold", "completed", "archived"]).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { id, ...patch } = data;
    const { error } = await supabaseAdmin.from("projects").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("projects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addProjectMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      project_id: z.string().uuid(),
      user_id: z.string().uuid(),
      role: z.enum(["lead", "member", "viewer"]).default("member"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("project_members").upsert(
      { project_id: data.project_id, user_id: data.user_id, role: data.role },
      { onConflict: "project_id,user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeProjectMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ project_id: z.string().uuid(), user_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("project_members")
      .delete()
      .eq("project_id", data.project_id)
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addProjectResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      project_id: z.string().uuid(),
      kind: z.enum(["file", "url"]),
      label: z.string().min(1).max(200),
      url_or_path: z.string().min(1).max(2000),
      notes: z.string().max(2000).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("project_resources").insert({
      ...data, created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProjectResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("project_resources").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// MODULES
// ============================================================

export const upsertModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid().optional(),
      project_id: z.string().uuid(),
      title: z.string().min(1).max(200),
      description: z.string().max(5000).optional().nullable(),
      order_index: z.number().int().min(0).default(0),
      status: z.enum(["todo", "in_progress", "review", "done"]).default("todo"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.id) {
      const { id, ...patch } = data;
      const { error } = await supabaseAdmin.from("modules").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await supabaseAdmin.from("modules").insert(data).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("modules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// TASKS — admin create / lifecycle
// ============================================================

export const createTaskRich = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      user_id: z.string().uuid(),
      project_id: z.string().uuid().optional().nullable(),
      module_id: z.string().uuid().optional().nullable(),
      title: z.string().min(1).max(200),
      description: z.string().min(1).max(20000),
      
      deadline: z.string().optional().nullable(),
      priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
      estimate_hours: z.number().min(0).max(1000).optional().nullable(),
      checklist: z.array(z.object({
        id: z.string().min(1).max(64),
        text: z.string().min(1).max(500),
        done: z.boolean().default(false),
      })).max(50).default([]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: inserted, error } = await supabaseAdmin.from("tasks").insert({
      user_id: data.user_id,
      project_id: data.project_id ?? null,
      module_id: data.module_id ?? null,
      assigned_by: context.userId,
      title: data.title,
      description: data.description,
      deadline: data.deadline || null,
      priority: data.priority,
      estimate_hours: data.estimate_hours ?? null,
      checklist: data.checklist,
    }).select("id").single();
    if (error) throw new Error(error.message);
    await recordActivity(inserted.id, context.userId, "created", { title: data.title });
    return { id: inserted.id };
  });

// Employee starts a task → status becomes in_progress, started_at recorded,
// running time-log row inserted.
export const startTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ task_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: task, error } = await supabaseAdmin
      .from("tasks")
      .select("user_id, status, started_at")
      .eq("id", data.task_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!task) throw new Error("Task not found");
    if (task.user_id !== context.userId) {
      await assertAdmin(context.userId);
    }
    const patch: { status: "in_progress"; started_at?: string } = { status: "in_progress" };
    if (!task.started_at) patch.started_at = new Date().toISOString();
    const { error: e2 } = await supabaseAdmin.from("tasks").update(patch).eq("id", data.task_id);
    if (e2) throw new Error(e2.message);
    await recordActivity(data.task_id, context.userId, "started", {});
    return { ok: true };
  });

export const blockTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ task_id: z.string().uuid(), reason: z.string().min(1).max(2000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("tasks")
      .update({ status: "blocked", blocked_reason: data.reason })
      .eq("id", data.task_id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    await recordActivity(data.task_id, context.userId, "blocked", { reason: data.reason });
    return { ok: true };
  });

export const unblockTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ task_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("tasks")
      .update({ status: "in_progress", blocked_reason: null })
      .eq("id", data.task_id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    await recordActivity(data.task_id, context.userId, "unblocked", {});
    return { ok: true };
  });

export const updateChecklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      task_id: z.string().uuid(),
      checklist: z.array(z.object({
        id: z.string(), text: z.string(), done: z.boolean(),
      })).max(50),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: task } = await supabaseAdmin.from("tasks").select("user_id").eq("id", data.task_id).maybeSingle();
    if (!task) throw new Error("Task not found");
    if (task.user_id !== context.userId) await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("tasks")
      .update({ checklist: data.checklist })
      .eq("id", data.task_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      task_id: z.string().uuid(),
      submission_notes: z.string().max(20000).optional().nullable(),
      submission_url: z.string().max(2000).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("tasks")
      .update({
        status: "submitted",
        submission_notes: data.submission_notes ?? null,
        submission_url: data.submission_url ?? null,
      })
      .eq("id", data.task_id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    // Stop any running timer
    await supabaseAdmin
      .from("task_time_logs")
      .update({ ended_at: new Date().toISOString() })
      .eq("task_id", data.task_id)
      .eq("user_id", context.userId)
      .is("ended_at", null);
    await recordActivity(data.task_id, context.userId, "submitted", {});
    return { ok: true };
  });

// Admin requests changes — task returns to in_progress with reviewer notes.
export const requestChanges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ task_id: z.string().uuid(), notes: z.string().min(1).max(2000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: task, error } = await supabaseAdmin
      .from("tasks")
      .update({
        status: "changes_requested",
        review_notes: data.notes,
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
      })
      .eq("id", data.task_id)
      .select("user_id, title")
      .single();
    if (error) throw new Error(error.message);
    await recordActivity(data.task_id, context.userId, "changes_requested", { notes: data.notes });
    // Best-effort email
    try {
      const { data: profile } = await supabaseAdmin
        .from("profiles").select("email, full_name").eq("id", task.user_id).maybeSingle();
      if (profile?.email) {
        await sendTemplatedEmail({
          to: profile.email,
          toName: profile.full_name || undefined,
          templateKey: "task_changes_requested" as never,
          variables: {
            employee_name: profile.full_name || "there",
            task_title: task.title,
            review_notes: data.notes,
            task_url: buildTaskUrl(data.task_id),
          },
        });
      }
    } catch { /* swallow email errors */ }
    return { ok: true };
  });

// Admin-only: move a task between Kanban columns (status change).
// Used by the drag-and-drop board on the project detail page.
export const adminSetTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      task_id: z.string().uuid(),
      status: z.enum([
        "assigned", "in_progress", "blocked", "submitted",
        "approved", "rejected", "changes_requested",
      ]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const patch: {
      status: typeof data.status;
      started_at?: string;
      reviewed_at?: string;
      reviewed_by?: string;
    } = { status: data.status };
    if (data.status === "in_progress") patch.started_at = new Date().toISOString();
    if (data.status === "approved" || data.status === "rejected") {
      patch.reviewed_at = new Date().toISOString();
      patch.reviewed_by = context.userId;
    }
    const { error } = await supabaseAdmin.from("tasks").update(patch as never).eq("id", data.task_id);
    if (error) throw new Error(error.message);
    await recordActivity(data.task_id, context.userId, "status_changed", { status: data.status });
    return { ok: true };
  });

// ============================================================
// COMMENTS
// ============================================================

export const postComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ task_id: z.string().uuid(), body: z.string().min(1).max(5000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await supabaseAdmin
      .from("task_comments")
      .insert({ task_id: data.task_id, author_id: context.userId, body: data.body })
      .select("id, created_at")
      .single();
    if (error) throw new Error(error.message);
    await recordActivity(data.task_id, context.userId, "comment", { body: data.body.slice(0, 200) });
    // Best-effort: notify the OTHER party (assignee if commenter is admin, or admin via assigned_by)
    try {
      const { data: task } = await supabaseAdmin
        .from("tasks")
        .select("user_id, assigned_by, title")
        .eq("id", data.task_id)
        .maybeSingle();
      if (task) {
        const recipientId = context.userId === task.user_id ? task.assigned_by : task.user_id;
        if (recipientId && recipientId !== context.userId) {
          const [recip, author] = await Promise.all([
            supabaseAdmin.from("profiles").select("email, full_name").eq("id", recipientId).maybeSingle(),
            supabaseAdmin.from("profiles").select("full_name, email").eq("id", context.userId).maybeSingle(),
          ]);
          if (recip.data?.email) {
            await sendTemplatedEmail({
              to: recip.data.email,
              toName: recip.data.full_name || undefined,
              templateKey: "task_comment_added" as never,
              variables: {
                employee_name: recip.data.full_name || "there",
                author_name: author.data?.full_name || author.data?.email || "Teammate",
                task_title: task.title,
                comment_body: data.body.slice(0, 600),
                task_url: buildTaskUrl(data.task_id),
              },
            });
          }
        }
      }
    } catch { /* ignore email errors */ }
    return { id: row.id };
  });

// ============================================================
// TIME LOGS
// ============================================================

export const startTimer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ task_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    // Close any other running timer for this user first
    await supabaseAdmin
      .from("task_time_logs")
      .update({ ended_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("ended_at", null);
    const { data: row, error } = await supabaseAdmin
      .from("task_time_logs")
      .insert({ task_id: data.task_id, user_id: context.userId, started_at: new Date().toISOString() })
      .select("id, started_at")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, started_at: row.started_at };
  });

export const stopTimer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ task_id: z.string().uuid(), note: z.string().max(2000).optional().nullable() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: running } = await supabaseAdmin
      .from("task_time_logs")
      .select("id, started_at")
      .eq("user_id", context.userId)
      .eq("task_id", data.task_id)
      .is("ended_at", null)
      .maybeSingle();
    if (!running) return { ok: false, reason: "no-running-timer" };
    const ended = new Date();
    const minutes = Math.max(1, Math.round((ended.getTime() - new Date(running.started_at).getTime()) / 60000));
    const { error } = await supabaseAdmin
      .from("task_time_logs")
      .update({ ended_at: ended.toISOString(), minutes, note: data.note ?? null })
      .eq("id", running.id);
    if (error) throw new Error(error.message);
    await recordActivity(data.task_id, context.userId, "time_logged", { minutes });
    return { ok: true, minutes };
  });

export const logTimeManually = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      task_id: z.string().uuid(),
      minutes: z.number().int().min(1).max(24 * 60),
      note: z.string().max(2000).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const ended = new Date();
    const started = new Date(ended.getTime() - data.minutes * 60_000);
    const { error } = await supabaseAdmin.from("task_time_logs").insert({
      task_id: data.task_id, user_id: context.userId,
      started_at: started.toISOString(), ended_at: ended.toISOString(),
      minutes: data.minutes, note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    await recordActivity(data.task_id, context.userId, "time_logged", { minutes: data.minutes });
    return { ok: true };
  });

// ============================================================
// CREDENTIALS — encrypted vault
// ============================================================

export const upsertCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid().optional(),
      task_id: z.string().uuid(),
      label: z.string().min(1).max(200),
      username: z.string().max(500).optional().nullable(),
      password: z.string().min(1).max(2000),
      url: z.string().max(2000).optional().nullable(),
      notes: z.string().max(2000).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const password_encrypted = encryptSecret(data.password);
    if (data.id) {
      const { error } = await supabaseAdmin.from("task_credentials").update({
        label: data.label,
        username: data.username ?? null,
        password_encrypted,
        url: data.url ?? null,
        notes: data.notes ?? null,
      }).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabaseAdmin.from("task_credentials").insert({
      task_id: data.task_id,
      label: data.label,
      username: data.username ?? null,
      password_encrypted,
      url: data.url ?? null,
      notes: data.notes ?? null,
      created_by: context.userId,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("task_credentials").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Reveal: returns plaintext password to admin OR the assignee of the task.
// Every reveal is logged with viewer id, IP, UA.
export const revealCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ credential_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: cred, error } = await supabaseAdmin
      .from("task_credentials")
      .select("id, task_id, password_encrypted, label, username, url, notes")
      .eq("id", data.credential_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cred) throw new Error("Credential not found");

    // Authorize: admin OR task assignee
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    const isAdmin = !!roleRow;
    if (!isAdmin) {
      const { data: task } = await supabaseAdmin
        .from("tasks").select("user_id").eq("id", cred.task_id).maybeSingle();
      if (!task || task.user_id !== context.userId) {
        throw new Error("Forbidden");
      }
    }

    const ip = getRequestHeader("x-forwarded-for") || getRequestHeader("cf-connecting-ip") || "";
    const ua = getRequestHeader("user-agent") || "";
    await supabaseAdmin.from("credential_access_log").insert({
      credential_id: cred.id, viewer_id: context.userId,
      ip_address: ip ? String(ip).split(",")[0].trim() : null,
      user_agent: ua ? String(ua).slice(0, 500) : null,
    });

    const password = decryptSecret(cred.password_encrypted);
    return {
      label: cred.label,
      username: cred.username,
      password,
      url: cred.url,
      notes: cred.notes,
    };
  });

// Convenience used by admin UI to send module-assignment email after
// `addProjectMember` is called for a module-style assignment.
export const notifyModuleAssigned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ project_id: z.string().uuid(), module_id: z.string().uuid(), user_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const [proj, mod, profile] = await Promise.all([
      supabaseAdmin.from("projects").select("title").eq("id", data.project_id).maybeSingle(),
      supabaseAdmin.from("modules").select("title, description").eq("id", data.module_id).maybeSingle(),
      supabaseAdmin.from("profiles").select("email, full_name").eq("id", data.user_id).maybeSingle(),
    ]);
    if (!profile.data?.email) return { ok: false, reason: "no-email" };
    await sendTemplatedEmail({
      to: profile.data.email,
      toName: profile.data.full_name || undefined,
      templateKey: "module_assigned" as never,
      variables: {
        employee_name: profile.data.full_name || "there",
        module_title: mod.data?.title || "Module",
        project_title: proj.data?.title || "Project",
        module_description: (mod.data?.description || "").slice(0, 600),
        project_url: buildProjectUrl(data.project_id),
        dashboard_url: buildDashboardUrl(),
      },
    });
    return { ok: true };
  });

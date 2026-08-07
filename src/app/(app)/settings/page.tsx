"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Download,
  LogOut,
  Save,
  ShieldCheck,
  Upload,
  UserRound,
} from "lucide-react";
import { apiFetch, patchJson, postJson } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface MeData {
  user: { id: string; email: string; displayName: string | null };
  preferences: {
    timezone: string;
    maxDailyTasks: number;
    workStartTime: string;
    workEndTime: string;
    preferredFocusTime: string;
    requireConfirmation: boolean;
  };
}

interface ImportReport {
  goalsCreated: number;
  goalsSkipped: number;
  tasksCreated: number;
  tasksSkipped: number;
  failures: string[];
}

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<MeData>("/api/me"),
  });
  const [displayName, setDisplayName] = useState("");
  const [prefs, setPrefs] = useState({
    timezone: "Asia/Shanghai",
    maxDailyTasks: 5,
    workStartTime: "09:00",
    workEndTime: "22:00",
    preferredFocusTime: "morning",
  });
  const [legacyJson, setLegacyJson] = useState("");
  const [importReport, setImportReport] = useState<ImportReport | null>(null);

  useEffect(() => {
    if (me.data) {
      setDisplayName(me.data.user.displayName ?? "");
      setPrefs({
        timezone: me.data.preferences.timezone,
        maxDailyTasks: me.data.preferences.maxDailyTasks,
        workStartTime: me.data.preferences.workStartTime,
        workEndTime: me.data.preferences.workEndTime,
        preferredFocusTime: me.data.preferences.preferredFocusTime,
      });
    }
  }, [me.data]);

  async function saveProfile() {
    try {
      await patchJson("/api/me", { displayName });
      toast.success("显示名称已保存");
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    }
  }

  async function savePreferences() {
    try {
      await patchJson("/api/me/preferences", prefs);
      toast.success("偏好已保存");
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    }
  }

  function parseLegacyData() {
    try {
      return JSON.parse(legacyJson);
    } catch {
      toast.error("旧数据不是合法 JSON");
      return null;
    }
  }

  async function previewImport() {
    const data = parseLegacyData();
    if (!data) return;
    try {
      const report = await postJson<ImportReport>("/api/import/preview", { legacyData: data });
      setImportReport(report);
      toast.success("导入预览已生成");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "预览失败");
    }
  }

  async function executeImport() {
    const data = parseLegacyData();
    if (!data) return;
    try {
      const report = await postJson<ImportReport>("/api/import/execute", { legacyData: data });
      setImportReport(report);
      toast.success("导入完成");
      await queryClient.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导入失败");
    }
  }

  async function logout() {
    await postJson("/api/auth/logout");
    router.push("/login");
  }

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <p className="section-label">账户</p>
          <h1 className="page-title">设置</h1>
          <p className="page-subtitle">账户、规划偏好与旧数据导入</p>
        </div>
      </header>

      {me.isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card className="fade-up overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-gradient-to-br from-slate-50/90 to-blue-50/40">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="icon-chip icon-chip-blue">
                    <UserRound className="h-4 w-4" />
                  </span>
                  <div>
                    <CardTitle>账户</CardTitle>
                    <CardDescription className="mt-1">{me.data?.user.email}</CardDescription>
                  </div>
                </div>
                <Badge className="soft-badge-teal border-0">
                  <ShieldCheck className="h-3 w-3" />
                  已登录
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <div className="form-field">
                <Label htmlFor="displayName">显示名称</Label>
                <div className="flex gap-2">
                  <Input id="displayName" value={displayName} maxLength={60} onChange={(e) => setDisplayName(e.target.value)} placeholder="输入显示名称" />
                  <Button onClick={saveProfile}><Save className="h-4 w-4" />保存</Button>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-teal-100 bg-teal-50/70 p-3">
                <div>
                  <p className="text-sm font-semibold text-teal-900">要求确认</p>
                  <p className="mt-0.5 text-xs text-teal-700/80">Agent 写操作必须确认，V1.0 不可关闭</p>
                </div>
                <Badge className="soft-badge-teal border-0">
                  <ShieldCheck className="h-3 w-3" />
                  开启
                </Badge>
              </div>
              <Button variant="outline" className="w-full" onClick={logout}>
                <LogOut className="h-4 w-4" />
                退出登录
              </Button>
            </CardContent>
          </Card>

          <Card className="fade-up">
            <CardHeader>
              <CardTitle>规划偏好</CardTitle>
              <CardDescription>Agent 请求会立即使用最新偏好</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="form-field">
                <Label htmlFor="timezone">时区</Label>
                <Input id="timezone" value={prefs.timezone} onChange={(e) => setPrefs({ ...prefs, timezone: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="form-field">
                  <Label htmlFor="maxDailyTasks">每日任务上限</Label>
                  <Input id="maxDailyTasks" type="number" min={1} max={12} value={prefs.maxDailyTasks} onChange={(e) => setPrefs({ ...prefs, maxDailyTasks: Number(e.target.value) })} />
                </div>
                <div className="form-field">
                  <Label htmlFor="focus">专注时段</Label>
                  <Select id="focus" value={prefs.preferredFocusTime} onChange={(e) => setPrefs({ ...prefs, preferredFocusTime: e.target.value })}>
                    <option value="morning">上午</option>
                    <option value="afternoon">下午</option>
                    <option value="evening">晚上</option>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="form-field">
                  <Label htmlFor="workStart">开始时间</Label>
                  <Input id="workStart" type="time" value={prefs.workStartTime} onChange={(e) => setPrefs({ ...prefs, workStartTime: e.target.value })} />
                </div>
                <div className="form-field">
                  <Label htmlFor="workEnd">结束时间</Label>
                  <Input id="workEnd" type="time" value={prefs.workEndTime} onChange={(e) => setPrefs({ ...prefs, workEndTime: e.target.value })} />
                </div>
              </div>
              <Button onClick={savePreferences}><Save className="h-4 w-4" />保存偏好</Button>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="fade-up">
        <CardHeader>
          <CardTitle>旧数据导入</CardTitle>
          <CardDescription>粘贴 Planner Board 的 localStorage JSON（focuses + days）</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={legacyJson}
            onChange={(event) => setLegacyJson(event.target.value)}
            placeholder='{"focuses":[],"days":{}}'
            className="min-h-40 font-mono text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={previewImport}>
              <Download className="h-4 w-4" />
              预览导入
            </Button>
            <Button onClick={executeImport}>
              <Upload className="h-4 w-4" />
              执行导入
            </Button>
          </div>
          {importReport ? (
            <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-4 text-sm leading-7 text-slate-700">
              <div className="mb-2 flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm">
                  <Upload className="h-4 w-4" />
                </span>
                <p className="font-semibold text-slate-900">导入结果</p>
              </div>
              <p>新增目标 {importReport.goalsCreated}，跳过 {importReport.goalsSkipped}</p>
              <p>新增任务 {importReport.tasksCreated}，跳过 {importReport.tasksSkipped}</p>
              {importReport.failures.length ? (
                <p className="mt-2 text-rose-600">失败：{importReport.failures.join("；")}</p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

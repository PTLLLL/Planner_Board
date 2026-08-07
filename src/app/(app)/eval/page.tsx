"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BarChart3, CheckCircle2, ClipboardCheck, Play, ShieldAlert, XCircle } from "lucide-react";
import { apiFetch, postJson } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface EvalSummary {
  totalCases: number;
  totalResults: number;
  passed: number;
  failed: number;
  jsonSuccessRate: number;
  lastRunAt: string | null;
}

interface EvalCase {
  id: string;
  name: string;
  category: string;
  userQuery: string;
  expectedTools: string[];
}

interface EvalResult {
  id: string;
  caseName: string;
  category: string;
  passed: boolean;
  score: number;
  toolCallAccuracy: number;
  dateParsingAccuracy: number;
  failureCategory: string | null;
  notes: string | null;
}

const categories = [
  "plan_today",
  "create_task",
  "update_task",
  "move_task",
  "split_task",
  "decompose_goal",
  "clarification",
  "safety",
];

export default function EvalDashboardPage() {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState("");
  const [running, setRunning] = useState(false);

  const summary = useQuery({
    queryKey: ["eval-summary"],
    queryFn: () => apiFetch<EvalSummary>("/api/eval/summary"),
  });
  const cases = useQuery({
    queryKey: ["eval-cases", category],
    queryFn: () =>
      apiFetch<{ items: EvalCase[]; total: number }>(
        `/api/eval/cases?pageSize=100${category ? `&category=${category}` : ""}`,
      ),
    staleTime: 60_000,
  });
  const results = useQuery({
    queryKey: ["eval-results", category],
    queryFn: () =>
      apiFetch<{ items: EvalResult[]; total: number }>(
        `/api/eval/results?pageSize=100${category ? `&category=${category}` : ""}`,
      ),
    staleTime: 60_000,
  });

  async function runEvaluation() {
    setRunning(true);
    try {
      await postJson("/api/eval/run", {
        categories: category ? [category] : [],
      });
      toast.success("评估完成");
      await queryClient.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "评估失败");
    } finally {
      setRunning(false);
    }
  }

  const badCases = results.data?.items.filter((result) => !result.passed) ?? [];
  const passRate = Math.round((summary.data?.jsonSuccessRate ?? 0) * 100);

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <p className="section-label">质量</p>
          <h1 className="page-title">评估中心</h1>
          <p className="page-subtitle">Agent 质量评估与 Bad Case</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={category} onChange={(event) => setCategory(event.target.value)} className="w-44">
            <option value="">全部类别</option>
            {categories.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </Select>
          <Button onClick={runEvaluation} disabled={running}>
            <Play className="h-4 w-4" />
            {running ? "运行中..." : "运行评估"}
          </Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="metric-card fade-up">
          <div className="metric-card-topline">
            <span className="metric-label">测试用例总数</span>
            <span className="icon-chip icon-chip-blue">
              <ClipboardCheck className="h-4 w-4" />
            </span>
          </div>
          <span className="metric-value">{summary.data?.totalCases ?? 0}</span>
          <p className="mt-1 text-xs text-slate-400">已配置的评估用例</p>
        </div>
        <div className="metric-card fade-up">
          <div className="metric-card-topline">
            <span className="metric-label">已运行用例数</span>
            <span className="icon-chip icon-chip-teal">
              <BarChart3 className="h-4 w-4" />
            </span>
          </div>
          <span className="metric-value">{summary.data?.totalResults ?? 0}</span>
          <p className="mt-1 text-xs text-slate-400">生成过评估结果的用例</p>
        </div>
        <div className="metric-card fade-up">
          <div className="metric-card-topline">
            <span className="metric-label">通过</span>
            <span className="icon-chip icon-chip-teal">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
          <span className="metric-value">{summary.data?.passed ?? 0}</span>
          <p className="mt-1 text-xs text-slate-400">全部维度通过</p>
        </div>
        <div className="metric-card fade-up">
          <div className="metric-card-topline">
            <span className="metric-label">失败</span>
            <span className="icon-chip icon-chip-rose">
              <XCircle className="h-4 w-4" />
            </span>
          </div>
          <span className="metric-value">{summary.data?.failed ?? 0}</span>
          <p className="mt-1 text-xs text-slate-400">需要关注的 Bad Case</p>
        </div>
        <div className="metric-card fade-up">
          <div className="metric-card-topline">
            <span className="metric-label">通过率</span>
            <span className="icon-chip icon-chip-amber">
              <ShieldAlert className="h-4 w-4" />
            </span>
          </div>
          <span className="metric-value">{passRate}%</span>
          <p className="mt-1 text-xs text-slate-400">{summary.data?.lastRunAt ? `上次运行 ${summary.data.lastRunAt}` : "暂无运行记录"}</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="panel-card fade-up">
          <div className="panel-card-header">
            <div>
              <h2 className="panel-card-title">测试用例</h2>
              <p className="mt-0.5 text-xs text-slate-400">{category || "全部类别"}</p>
            </div>
            <Badge className="soft-badge-blue border-0">
              {cases.data?.total ?? 0} 条
            </Badge>
          </div>
          <div className="panel-card-body">
            {cases.isLoading ? (
              <Skeleton className="h-64" />
            ) : (
              <Table className={cn("data-table transition-opacity duration-150", cases.isFetching && "opacity-70")}>
                <TableHeader>
                  <TableRow>
                    <TableHead>名称</TableHead>
                    <TableHead>类别</TableHead>
                    <TableHead>用户请求</TableHead>
                    <TableHead>期望工具</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cases.data?.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="max-w-48 truncate font-medium text-slate-800">{item.name}</TableCell>
                      <TableCell><Badge className="soft-badge-blue border-0">{item.category}</Badge></TableCell>
                      <TableCell className="max-w-64 truncate text-slate-500">{item.userQuery}</TableCell>
                      <TableCell className="text-xs text-slate-500">{item.expectedTools.join(",") || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        <div className="panel-card fade-up">
          <div className="panel-card-header">
            <div>
              <h2 className="panel-card-title">评估结果与 Bad Case</h2>
              <p className="mt-0.5 text-xs text-slate-400">工具调用与日期解析准确率</p>
            </div>
            {badCases.length ? (
              <Badge className="soft-badge-rose border-0">
                <ShieldAlert className="h-3 w-3" />
                {badCases.length} 个 Bad Case
              </Badge>
            ) : (
              <Badge className="soft-badge-teal border-0">全部通过</Badge>
            )}
          </div>
          <div className="panel-card-body">
            {results.isLoading ? (
              <Skeleton className="h-64" />
            ) : (
              <Table className={cn("data-table transition-opacity duration-150", results.isFetching && "opacity-70")}>
                <TableHeader>
                  <TableRow>
                    <TableHead>用例</TableHead>
                    <TableHead>通过</TableHead>
                    <TableHead>工具准确率</TableHead>
                    <TableHead>日期准确率</TableHead>
                    <TableHead>失败分类</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.data?.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="max-w-44 truncate font-medium text-slate-800">{item.caseName}</TableCell>
                      <TableCell>
                        {item.passed ? (
                          <Badge className="soft-badge-teal border-0">通过</Badge>
                        ) : (
                          <Badge className="soft-badge-rose border-0">失败</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">{Math.round(item.toolCallAccuracy * 100)}%</TableCell>
                      <TableCell className="text-xs text-slate-500">{Math.round(item.dateParsingAccuracy * 100)}%</TableCell>
                      <TableCell className="text-xs text-slate-500">{item.failureCategory ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {badCases.length ? (
              <div className="mt-4 rounded-lg border border-rose-100 bg-rose-50 p-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-rose-700">
                  <ShieldAlert className="h-4 w-4" />
                  Bad Case 共 {badCases.length} 个
                </p>
                <ul className="space-y-1.5 text-xs leading-5 text-rose-600">
                  {badCases.slice(0, 5).map((item) => (
                    <li key={item.id} className="flex items-start gap-2">
                      <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400")} />
                      <span>{item.caseName}：{item.failureCategory ?? "失败"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

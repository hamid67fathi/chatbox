"use client";

import { Button } from "@/components/ui/button";
import type { FlowDefinition, FlowNodeType, FlowRecord } from "@/lib/api";
import {
	createFlow,
	deleteFlow,
	fetchFlows,
	publishFlow,
	unpublishFlow,
	updateFlow,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import {
	Background,
	Controls,
	Handle,
	MiniMap,
	Position,
	ReactFlow,
	addEdge,
	useEdgesState,
	useNodesState,
	type Connection,
	type Edge,
	type Node,
	type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useState } from "react";

interface Props {
	workspaceId: string;
	workspaceRole: string;
}

const NODE_LABELS: Record<FlowNodeType, string> = {
	start: "شروع",
	message: "پیام",
	question: "سوال",
	condition: "شرط",
	handoff: "اپراتور",
};

const NODE_COLORS: Record<FlowNodeType, string> = {
	start: "border-muted-foreground/40 bg-muted",
	message: "border-blue-500/50 bg-blue-500/10",
	question: "border-amber-500/50 bg-amber-500/10",
	condition: "border-purple-500/50 bg-purple-500/10",
	handoff: "border-emerald-500/50 bg-emerald-500/10",
};

type FlowNodeData = {
	flowType: FlowNodeType;
	text?: string;
	variable?: string;
};

function FlowCanvasNode({ data, selected }: NodeProps<Node<FlowNodeData>>) {
	const t = data.flowType;
	const preview =
		t === "message" || t === "question" || t === "handoff"
			? (data.text?.slice(0, 60) ?? "")
			: "";
	return (
		<div
			className={cn(
				"min-w-[140px] rounded-lg border-2 px-3 py-2 text-xs shadow-sm",
				NODE_COLORS[t],
				selected && "ring-2 ring-primary",
			)}
		>
			{t !== "start" && (
				<Handle type="target" position={Position.Top} className="!bg-primary" />
			)}
			<p className="font-semibold">{NODE_LABELS[t]}</p>
			{preview ? (
				<p className="mt-1 text-muted-foreground line-clamp-2">{preview}</p>
			) : null}
			{t !== "handoff" && (
				<Handle
					type="source"
					position={Position.Bottom}
					className="!bg-primary"
				/>
			)}
		</div>
	);
}

const nodeTypes = { flowNode: FlowCanvasNode };

function toReactFlow(def: FlowDefinition): { nodes: Node<FlowNodeData>[]; edges: Edge[] } {
	return {
		nodes: def.nodes.map((n, i) => ({
			id: n.id,
			type: "flowNode",
			position: n.position ?? { x: 200, y: i * 120 },
			data: {
				flowType: n.type,
				text: typeof n.data.text === "string" ? n.data.text : undefined,
				variable:
					typeof n.data.variable === "string" ? n.data.variable : undefined,
			},
		})),
		edges: def.edges.map((e) => ({
			id: e.id,
			source: e.source,
			target: e.target,
			sourceHandle: e.sourceHandle ?? undefined,
		})),
	};
}

function fromReactFlow(
	nodes: Node<FlowNodeData>[],
	edges: Edge[],
): FlowDefinition {
	return {
		nodes: nodes.map((n) => ({
			id: n.id,
			type: n.data.flowType,
			position: n.position,
			data: {
				...(n.data.text ? { text: n.data.text } : {}),
				...(n.data.variable ? { variable: n.data.variable } : {}),
			},
		})),
		edges: edges.map((e) => ({
			id: e.id,
			source: e.source,
			target: e.target,
			sourceHandle: e.sourceHandle ?? null,
		})),
	};
}

export function FlowBuilderPanel({ workspaceId, workspaceRole }: Props) {
	const canEdit = workspaceRole === "owner" || workspaceRole === "admin";
	const [flows, setFlows] = useState<FlowRecord[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [flowName, setFlowName] = useState("");
	const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>([]);
	const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
	const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [msg, setMsg] = useState("");
	const [error, setError] = useState("");

	const selectedFlow = flows.find((f) => f.id === selectedId) ?? null;
	const selectedNode = useMemo(
		() => nodes.find((n) => n.id === selectedNodeId) ?? null,
		[nodes, selectedNodeId],
	);

	const reload = useCallback(async () => {
		const list = await fetchFlows(workspaceId);
		setFlows(list);
		setSelectedId((prev) => prev ?? list[0]?.id ?? null);
	}, [workspaceId]);

	useEffect(() => {
		void reload();
	}, [reload]);

	useEffect(() => {
		if (!selectedFlow) {
			setNodes([]);
			setEdges([]);
			setFlowName("");
			return;
		}
		setFlowName(selectedFlow.name);
		const rf = toReactFlow(selectedFlow.definition);
		setNodes(rf.nodes);
		setEdges(rf.edges);
	}, [selectedFlow, setNodes, setEdges]);

	const onConnect = useCallback(
		(params: Connection) => {
			if (!canEdit) return;
			setEdges((eds) =>
				addEdge({ ...params, id: `e-${params.source}-${params.target}` }, eds),
			);
		},
		[canEdit, setEdges],
	);

	async function handleCreate() {
		const row = await createFlow(workspaceId, "جریان جدید");
		if (!row) {
			setError("ایجاد جریان ناموفق بود.");
			return;
		}
		setFlows((prev) => [row, ...prev]);
		setSelectedId(row.id);
		setMsg("جریان جدید ایجاد شد.");
	}

	async function handleSave() {
		if (!selectedId || !canEdit) return;
		setSaving(true);
		setError("");
		const result = await updateFlow(workspaceId, selectedId, {
			name: flowName,
			definition: fromReactFlow(nodes, edges),
		});
		setSaving(false);
		if (!result.ok) {
			setError(result.error ?? "خطا");
			return;
		}
		if (result.data) {
			setFlows((prev) =>
				prev.map((f) => (f.id === result.data!.id ? result.data! : f)),
			);
		}
		setMsg("ذخیره شد.");
	}

	async function handlePublish() {
		if (!selectedId || !canEdit) return;
		const result = await publishFlow(workspaceId, selectedId);
		if (!result.ok) {
			setError(result.error ?? "خطا");
			return;
		}
		if (result.data) {
			setFlows((prev) =>
				prev.map((f) =>
					f.trigger === result.data!.trigger && f.id !== result.data!.id
						? { ...f, status: "draft", publishedAt: null }
						: f.id === result.data!.id
							? result.data!
							: f,
				),
			);
		}
		setMsg("جریان منتشر شد و روی ویجت فعال است.");
	}

	async function handleUnpublish() {
		if (!selectedId || !canEdit) return;
		const result = await unpublishFlow(workspaceId, selectedId);
		if (!result.ok) {
			setError(result.error ?? "خطا");
			return;
		}
		if (result.data) {
			setFlows((prev) =>
				prev.map((f) => (f.id === result.data!.id ? result.data! : f)),
			);
		}
		setMsg("انتشار لغو شد.");
	}

	async function handleDelete() {
		if (!selectedId || !canEdit) return;
		if (!confirm("این جریان حذف شود؟")) return;
		const ok = await deleteFlow(workspaceId, selectedId);
		if (!ok) {
			setError("حذف ناموفق بود.");
			return;
		}
		setFlows((prev) => prev.filter((f) => f.id !== selectedId));
		setSelectedId(null);
	}

	function addNode(type: FlowNodeType) {
		if (!canEdit || type === "start") return;
		const id = `${type}-${Date.now()}`;
		setNodes((nds) => [
			...nds,
			{
				id,
				type: "flowNode",
				position: { x: 240, y: nds.length * 100 },
				data: {
					flowType: type,
					text:
						type === "message"
							? "متن پیام"
							: type === "question"
								? "سوال شما؟"
								: type === "handoff"
									? "اپراتور به زودی پاسخ می‌دهد."
									: undefined,
					variable: type === "question" ? "answer" : undefined,
				},
			},
		]);
	}

	function updateSelectedNode(patch: Partial<FlowNodeData>) {
		if (!selectedNodeId) return;
		setNodes((nds) =>
			nds.map((n) =>
				n.id === selectedNodeId
					? { ...n, data: { ...n.data, ...patch } }
					: n,
			),
		);
	}

	return (
		<div className="flex h-full min-h-0 flex-col gap-4 p-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div>
					<h1 className="text-lg font-semibold">جریان‌های گفتگو</h1>
					<p className="text-sm text-muted-foreground">
						طراحی چت‌بات ویجت: پیام، سوال، انتقال به اپراتور
					</p>
				</div>
				{canEdit && (
					<Button type="button" onClick={() => void handleCreate()}>
						جریان جدید
					</Button>
				)}
			</div>

			<div className="flex min-h-0 flex-1 gap-4">
				<aside className="flex w-52 shrink-0 flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-card p-2">
					{flows.length === 0 ? (
						<p className="p-2 text-xs text-muted-foreground">هنوز جریانی نیست.</p>
					) : (
						flows.map((f) => (
							<button
								key={f.id}
								type="button"
								onClick={() => setSelectedId(f.id)}
								className={cn(
									"rounded-md px-2 py-2 text-start text-sm transition-colors",
									f.id === selectedId
										? "bg-primary/10 text-primary"
										: "hover:bg-accent",
								)}
							>
								<span className="font-medium">{f.name}</span>
								<span className="mt-0.5 block text-xs text-muted-foreground">
									{f.status === "published" ? "منتشر شده" : "پیش‌نویس"}
								</span>
							</button>
						))
					)}
				</aside>

				{selectedFlow ? (
					<div className="flex min-h-0 flex-1 flex-col gap-3">
						<div className="flex flex-wrap items-center gap-2">
							<input
								className="h-9 min-w-[180px] flex-1 rounded-md border border-input bg-background px-3 text-sm"
								value={flowName}
								onChange={(e) => setFlowName(e.target.value)}
								disabled={!canEdit}
							/>
							{canEdit && (
								<>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => addNode("message")}
									>
										+ پیام
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => addNode("question")}
									>
										+ سوال
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => addNode("handoff")}
									>
										+ اپراتور
									</Button>
									<Button
										type="button"
										size="sm"
										disabled={saving}
										onClick={() => void handleSave()}
									>
										{saving ? "…" : "ذخیره"}
									</Button>
									{selectedFlow.status === "published" ? (
										<Button
											type="button"
											variant="secondary"
											size="sm"
											onClick={() => void handleUnpublish()}
										>
											لغو انتشار
										</Button>
									) : (
										<Button
											type="button"
											size="sm"
											onClick={() => void handlePublish()}
										>
											انتشار
										</Button>
									)}
									<Button
										type="button"
										variant="destructive"
										size="sm"
										onClick={() => void handleDelete()}
									>
										حذف
									</Button>
								</>
							)}
						</div>

						<div className="relative min-h-[420px] flex-1 rounded-lg border border-border bg-muted/20">
							<ReactFlow
								nodes={nodes}
								edges={edges}
								onNodesChange={onNodesChange}
								onEdgesChange={onEdgesChange}
								onConnect={onConnect}
								nodeTypes={nodeTypes}
								onNodeClick={(_, n) => setSelectedNodeId(n.id)}
								fitView
								nodesDraggable={canEdit}
								nodesConnectable={canEdit}
								elementsSelectable={canEdit}
							>
								<Background />
								<Controls />
								<MiniMap />
							</ReactFlow>
						</div>

						{selectedNode && canEdit && (
							<div className="rounded-lg border border-border bg-card p-3 text-sm">
								<p className="mb-2 font-medium">
									ویرایش: {NODE_LABELS[selectedNode.data.flowType]}
								</p>
								{(selectedNode.data.flowType === "message" ||
									selectedNode.data.flowType === "question" ||
									selectedNode.data.flowType === "handoff") && (
									<label className="block">
										<span className="text-muted-foreground">متن</span>
										<textarea
											className="mt-1 w-full rounded-md border border-input bg-background p-2"
											rows={3}
											value={selectedNode.data.text ?? ""}
											onChange={(e) =>
												updateSelectedNode({ text: e.target.value })
											}
										/>
									</label>
								)}
								{selectedNode.data.flowType === "question" && (
									<label className="mt-2 block">
										<span className="text-muted-foreground">نام متغیر</span>
										<input
											className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1"
											value={selectedNode.data.variable ?? "answer"}
											onChange={(e) =>
												updateSelectedNode({ variable: e.target.value })
											}
										/>
									</label>
								)}
							</div>
						)}
					</div>
				) : (
					<div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
						یک جریان انتخاب کنید یا جریان جدید بسازید.
					</div>
				)}
			</div>

			{error && <p className="text-sm text-destructive">{error}</p>}
			{msg && <p className="text-sm text-primary">{msg}</p>}
		</div>
	);
}

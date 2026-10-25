"use client";

import { useRef, useState, useTransition } from "react";
import { saveTemplate } from "@/lib/documents/actions";
import {
  assignmentFilterOptions,
  blockTypeOptions,
  chartKindOptions,
  createBlock,
  dueFilterOptions,
  memberColumnOptions,
  memberSortOptions,
  newBlockId,
  signerOptions,
  taskColumnOptions,
  taskSortOptions,
  templateLimits,
  variableOptions,
  type BlockType,
  type DocumentTemplate,
  type TemplateBlock,
} from "@/lib/documents/template-schema";
import {
  taskPriorities,
  taskPriorityLabels,
  taskStatuses,
  taskStatusLabels,
  type DocumentProject,
} from "@/lib/documents/types";
import DocumentSheet, { type BlockFrame } from "./document-sheet";

type BuilderProps = {
  // The template being edited, or a built-in/blank starting point for a new one.
  source: DocumentTemplate;
  projects: DocumentProject[];
  projectId: number;
  onProjectChange: (projectId: number) => void;
  today: string;
  onCancel: () => void;
  onSaved: (template: DocumentTemplate) => void;
};

type Option = { key: string; label: string };

const blockLabels = Object.fromEntries(blockTypeOptions.map((option) => [option.type, option.label])) as Record<
  BlockType,
  string
>;

// Stroke icons for the block tools; text glyphs like ↑ render as color emoji on Windows.
const toolIcons = {
  up: "M8 13V3M3.5 7.5 8 3l4.5 4.5",
  down: "M8 3v10M3.5 8.5 8 13l4.5-4.5",
  duplicate: "M5.5 5.5h7v7h-7zM3.5 10.5v-7h7",
  remove: "M4 4l8 8M12 4l-8 8",
  add: "M8 3v10M3 8h10",
  trash: "M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5M7 7v4M9 7v4",
  grip: "M6 4h.01M10 4h.01M6 8h.01M10 8h.01M6 12h.01M10 12h.01",
};

function ToolIcon({ name }: { name: keyof typeof toolIcons }) {
  return (
    <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 16 16" width="14">
      <path d={toolIcons[name]} />
    </svg>
  );
}

// Chips whose click order defines the order of columns, facts or figures.
function OrderedChips({
  options,
  value,
  onChange,
  max,
}: {
  options: readonly Option[];
  value: string[];
  onChange: (value: string[]) => void;
  max?: number;
}) {
  return (
    <div className="chip-group">
      {options.map((option) => {
        const position = value.indexOf(option.key);
        const selected = position !== -1;
        const disabled = !selected && max !== undefined && value.length >= max;
        return (
          <button
            aria-pressed={selected}
            className={`chip${selected ? " selected" : ""}`}
            disabled={disabled}
            key={option.key}
            onClick={() =>
              onChange(selected ? value.filter((key) => key !== option.key) : [...value, option.key])
            }
            type="button"
          >
            {selected && <span className="chip-order">{position + 1}</span>}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function VariableText({
  label,
  value,
  onChange,
  multiline,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  maxLength: number;
}) {
  const fieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  function insertVariable(key: string) {
    const field = fieldRef.current;
    const token = `{{${key}}}`;
    const start = field?.selectionStart ?? value.length;
    const end = field?.selectionEnd ?? value.length;
    onChange((value.slice(0, start) + token + value.slice(end)).slice(0, maxLength));
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  const Field = multiline ? "textarea" : "input";
  return (
    <div className="builder-field">
      <div className="builder-field-heading">
        <span className="field-label">{label}</span>
        <select
          aria-label="Insert variable"
          className="variable-select"
          onChange={(event) => {
            if (event.target.value) insertVariable(event.target.value);
            event.target.value = "";
          }}
          value=""
        >
          <option value="">+ Insert data</option>
          {variableOptions.map((option) => (
            <option key={option.key} value={option.key}>{option.label}</option>
          ))}
        </select>
      </div>
      <Field
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        ref={fieldRef}
        rows={multiline ? 5 : undefined}
        value={value}
      />
    </div>
  );
}

function SelectField({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly Option[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="builder-field">
      <span className="field-label">{label}</span>
      <select onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => (
          <option key={option.key} value={option.key}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function TitleField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <VariableText label="Section title" maxLength={templateLimits.title} onChange={onChange} value={value} />;
}

const statusOptions = taskStatuses.map((status) => ({ key: status, label: taskStatusLabels[status] }));
const priorityOptions = taskPriorities.map((priority) => ({ key: priority, label: taskPriorityLabels[priority] }));

function BlockEditor({ block, onChange }: { block: TemplateBlock; onChange: (block: TemplateBlock) => void }) {
  switch (block.type) {
    case "heading":
      return (
        <VariableText
          label="Heading"
          maxLength={templateLimits.title}
          onChange={(text) => onChange({ ...block, text })}
          value={block.text}
        />
      );
    case "text":
      return (
        <VariableText
          label="Text — values in {{ }} are filled from the selected project"
          maxLength={templateLimits.text}
          multiline
          onChange={(text) => onChange({ ...block, text })}
          value={block.text}
        />
      );
    case "facts":
      return (
        <>
          <TitleField onChange={(title) => onChange({ ...block, title })} value={block.title} />
          <span className="field-label">Rows (in click order)</span>
          <OrderedChips
            onChange={(facts) => onChange({ ...block, facts: facts as typeof block.facts })}
            options={variableOptions}
            value={block.facts}
          />
        </>
      );
    case "metrics":
      return (
        <>
          <span className="field-label">Figures (up to 6, in click order)</span>
          <OrderedChips
            max={6}
            onChange={(metrics) => onChange({ ...block, metrics: metrics as typeof block.metrics })}
            options={variableOptions}
            value={block.metrics}
          />
        </>
      );
    case "chart":
      return (
        <>
          <SelectField
            label="Chart"
            onChange={(kind) => {
              const previous = chartKindOptions.find((option) => option.key === block.kind)?.label;
              const next = chartKindOptions.find((option) => option.key === kind)?.label ?? "";
              // Keep a custom title; follow the chart name while it is still the default.
              const title = !block.title || block.title === previous ? next : block.title;
              onChange({ ...block, kind: kind as typeof block.kind, title });
            }}
            options={chartKindOptions}
            value={block.kind}
          />
          <TitleField onChange={(title) => onChange({ ...block, title })} value={block.title} />
        </>
      );
    case "taskTable":
      return (
        <>
          <TitleField onChange={(title) => onChange({ ...block, title })} value={block.title} />
          <span className="field-label">Columns (in click order)</span>
          <OrderedChips
            onChange={(columns) => onChange({ ...block, columns: columns as typeof block.columns })}
            options={taskColumnOptions}
            value={block.columns}
          />
          <span className="field-label">Only these statuses (none = all)</span>
          <OrderedChips
            onChange={(statuses) =>
              onChange({ ...block, filter: { ...block.filter, statuses: statuses as typeof block.filter.statuses } })
            }
            options={statusOptions}
            value={block.filter.statuses}
          />
          <span className="field-label">Only these priorities (none = all)</span>
          <OrderedChips
            onChange={(priorities) =>
              onChange({
                ...block,
                filter: { ...block.filter, priorities: priorities as typeof block.filter.priorities },
              })
            }
            options={priorityOptions}
            value={block.filter.priorities}
          />
          <div className="builder-row">
            <SelectField
              label="Deadline"
              onChange={(due) => onChange({ ...block, filter: { ...block.filter, due: due as typeof block.filter.due } })}
              options={dueFilterOptions}
              value={block.filter.due}
            />
            <SelectField
              label="Assigned to"
              onChange={(assignment) =>
                onChange({
                  ...block,
                  filter: { ...block.filter, assignment: assignment as typeof block.filter.assignment },
                })
              }
              options={assignmentFilterOptions}
              value={block.filter.assignment}
            />
          </div>
          <div className="builder-row">
            <SelectField
              label="Sort by"
              onChange={(sort) => onChange({ ...block, sort: sort as typeof block.sort })}
              options={taskSortOptions}
              value={block.sort}
            />
            <label className="builder-field">
              <span className="field-label">Max rows</span>
              <input
                min={1}
                max={200}
                onChange={(event) => {
                  const limit = Number.parseInt(event.target.value, 10);
                  onChange({ ...block, limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 200) : null });
                }}
                placeholder="All"
                type="number"
                value={block.limit ?? ""}
              />
            </label>
          </div>
          <label className="builder-field">
            <span className="field-label">Text when no task matches</span>
            <input
              maxLength={templateLimits.title}
              onChange={(event) => onChange({ ...block, emptyText: event.target.value })}
              value={block.emptyText}
            />
          </label>
        </>
      );
    case "memberTable":
      return (
        <>
          <TitleField onChange={(title) => onChange({ ...block, title })} value={block.title} />
          <span className="field-label">Columns (in click order)</span>
          <OrderedChips
            onChange={(columns) => onChange({ ...block, columns: columns as typeof block.columns })}
            options={memberColumnOptions}
            value={block.columns}
          />
          <SelectField
            label="Sort by"
            onChange={(sort) => onChange({ ...block, sort: sort as typeof block.sort })}
            options={memberSortOptions}
            value={block.sort}
          />
        </>
      );
    case "signatures":
      return (
        <>
          <TitleField onChange={(title) => onChange({ ...block, title })} value={block.title} />
          <SelectField
            label="Who signs"
            onChange={(signers) => onChange({ ...block, signers: signers as typeof block.signers })}
            options={signerOptions}
            value={block.signers}
          />
        </>
      );
    case "pageBreak":
      return <p className="builder-hint">The next block starts on a new page in the exported PDF.</p>;
  }
}

function BlockPalette({ disabled, onPick }: { disabled: boolean; onPick: (type: BlockType) => void }) {
  return (
    <div className="block-palette">
      {blockTypeOptions.map((option) => (
        <button disabled={disabled} key={option.type} onClick={() => onPick(option.type)} type="button">
          <strong>{option.label}</strong>
          <span>{option.hint}</span>
        </button>
      ))}
    </div>
  );
}

export default function TemplateBuilder({
  source,
  projects,
  projectId,
  onProjectChange,
  today,
  onCancel,
  onSaved,
}: BuilderProps) {
  const editingId = source.isBuiltIn ? null : source.id;
  const [name, setName] = useState(source.isBuiltIn && source.name ? `${source.name} (copy)` : source.name);
  const [description, setDescription] = useState(source.description);
  const [blocks, setBlocks] = useState(source.blocks);
  const [showStatus, setShowStatus] = useState(source.showStatus);
  const [showName, setShowName] = useState(source.showName);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [insertTarget, setInsertTarget] = useState<number | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ index: number; before: boolean } | null>(null);
  const [error, setError] = useState("");
  const [isSaving, startSaving] = useTransition();

  const project = projects.find((item) => item.id === projectId) ?? projects.at(0);
  // A saved project template stays in its project; new templates go to the selected one.
  const projectLocked = editingId !== null && source.projectId !== null;
  const selectedIndex = blocks.findIndex((block) => block.id === selectedBlockId);
  const selectedBlock = blocks[selectedIndex];
  const draft: DocumentTemplate = {
    id: "draft",
    name: name.trim() || "Untitled template",
    description,
    blocks,
    isBuiltIn: false,
    projectId: source.projectId,
    showStatus,
    showName,
  };
  const full = blocks.length >= templateLimits.blocks;

  function selectBlock(id: string | null) {
    setSelectedBlockId(id);
    setInsertTarget(null);
  }

  function startInsert(index: number) {
    setSelectedBlockId(null);
    setInsertTarget(index);
  }

  function updateBlock(updated: TemplateBlock) {
    setBlocks((current) => current.map((block) => (block.id === updated.id ? updated : block)));
  }

  function insertBlock(block: TemplateBlock, index: number) {
    setBlocks((current) => [...current.slice(0, index), block, ...current.slice(index)]);
    selectBlock(block.id);
  }

  function moveBlock(id: string, direction: -1 | 1) {
    setBlocks((current) => {
      const index = current.findIndex((block) => block.id === id);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function dropBlock() {
    if (draggedId && dropTarget) {
      setBlocks((current) => {
        const from = current.findIndex((block) => block.id === draggedId);
        let to = dropTarget.before ? dropTarget.index : dropTarget.index + 1;
        if (from === -1) return current;
        if (from < to) to -= 1;
        const next = [...current];
        next.splice(to, 0, ...next.splice(from, 1));
        return next;
      });
    }
    setDraggedId(null);
    setDropTarget(null);
  }

  function removeBlock(id: string) {
    setBlocks((current) => current.filter((block) => block.id !== id));
    selectBlock(null);
  }

  function handleSave() {
    setError("");
    startSaving(async () => {
      const result = await saveTemplate(editingId, { name, description, blocks, showStatus, showName }, project?.id ?? null);
      if (result.ok) onSaved(result.value);
      else setError(result.error);
    });
  }

  function insertPosition() {
    if (insertTarget === null) {
      return "Click a section in the preview to edit it, or drag it to reorder. New blocks go at the end; use + in the preview to place one elsewhere.";
    }
    if (insertTarget === 0) return "The new block goes at the top of the document.";
    if (insertTarget === blocks.length) return "The new block goes at the end of the document.";
    return `The new block goes after block ${insertTarget} (${blockLabels[blocks[insertTarget - 1].type]}).`;
  }

  function frame(block: TemplateBlock, index: number): BlockFrame {
    const selected = block.id === selectedBlockId;
    const insertButton = (at: number, position: "before" | "after") => (
      <button
        aria-label={`Add a block ${position} ${blockLabels[block.type]}`}
        aria-pressed={insertTarget === at}
        className={`block-insert ${position}`}
        disabled={full}
        onClick={(event) => {
          event.stopPropagation();
          startInsert(at);
        }}
        type="button"
      >
        <ToolIcon name="add" />
      </button>
    );
    const drop = dropTarget?.index === index ? (dropTarget.before ? " drop-before" : " drop-after") : "";
    return {
      className: `editable-block${selected ? " selected" : ""}${block.id === draggedId ? " dragging" : ""}${drop}`,
      onClick: () => selectBlock(block.id),
      // The whole block can be dragged; where it lands depends on the top or bottom half of the target.
      draggable: true,
      onDragStart: (event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", block.id);
        setDraggedId(block.id);
      },
      onDragEnd: () => {
        setDraggedId(null);
        setDropTarget(null);
      },
      onDragOver: (event) => {
        if (!draggedId) return;
        event.preventDefault();
        const box = event.currentTarget.getBoundingClientRect();
        const before = event.clientY < box.top + box.height / 2;
        if (dropTarget?.index !== index || dropTarget.before !== before) setDropTarget({ index, before });
      },
      onDrop: (event) => {
        event.preventDefault();
        dropBlock();
      },
      controls: (
        <>
          <button
            aria-label={`Edit ${blockLabels[block.type]}; drag to move`}
            aria-pressed={selected}
            className="block-label"
            onClick={(event) => {
              event.stopPropagation();
              selectBlock(selected ? null : block.id);
            }}
            type="button"
          >
            <ToolIcon name="grip" />
            {blockLabels[block.type]}
          </button>
          <button
            aria-label={`Remove ${blockLabels[block.type]}`}
            className="block-delete"
            onClick={(event) => {
              event.stopPropagation();
              removeBlock(block.id);
            }}
            title="Remove block"
            type="button"
          >
            <ToolIcon name="trash" />
          </button>
          {index === 0 && insertButton(0, "before")}
          {insertButton(index + 1, "after")}
        </>
      ),
    };
  }

  return (
    <div className="builder">
      <header className="documents-heading builder-heading">
        <div className="builder-title">
          <p className="eyebrow">WORKSPACE / DOCUMENTS / {editingId ? "EDIT" : "NEW"} TEMPLATE</p>
          <input
            aria-label="Template name"
            autoFocus={!name}
            className="builder-name"
            maxLength={templateLimits.name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Untitled template"
            value={name}
          />
          <input
            aria-label="Description"
            className="builder-description"
            maxLength={templateLimits.description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Add a short description: what is this document for?"
            value={description}
          />
        </div>
        <div className="heading-actions">
          <button className="secondary-button" disabled={isSaving} onClick={onCancel} type="button">
            Cancel
          </button>
          <button
            className="primary-button"
            disabled={isSaving || !name.trim() || blocks.length === 0}
            onClick={handleSave}
            type="button"
          >
            {isSaving ? "Saving…" : "Save template"}
          </button>
        </div>
      </header>

      {error && <p className="storage-notice" role="alert">{error}</p>}

      <div className="builder-layout">
        <section className="document-preview-area" aria-label="Live preview">
          <div className="preview-toolbar">
            <div className="builder-toggles">
              <span>Show in document</span>
              <label className="builder-toggle">
                <input checked={showName} onChange={(event) => setShowName(event.target.checked)} type="checkbox" />
                Template name
              </label>
              <label className="builder-toggle">
                <input checked={showStatus} onChange={(event) => setShowStatus(event.target.checked)} type="checkbox" />
                Project status
              </label>
            </div>
            {project && projectLocked && (
              <p className="builder-project" title="Use Copy to project to reuse this template elsewhere.">
                Project: <strong>{project.name}</strong>
              </p>
            )}
            {project && !projectLocked && (
              <select
                aria-label="Project"
                className="project-select compact"
                onChange={(event) => onProjectChange(Number(event.target.value))}
                title="The template is saved for this project."
                value={project.id}
              >
                {projects.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            )}
          </div>
          {project ? (
            <DocumentSheet frame={frame} project={project} template={draft} today={today} />
          ) : (
            <p className="builder-hint">Create a project to see a live preview.</p>
          )}
        </section>

        <aside
          aria-label={selectedBlock ? "Block settings" : "Add a block"}
          className={`builder-side${selectedBlock || insertTarget !== null ? " active" : ""}`}
        >
          {selectedBlock ? (
            <>
              <div className="builder-side-heading">
                <div>
                  <p className="eyebrow">BLOCK {selectedIndex + 1} OF {blocks.length}</p>
                  <h2>{blockLabels[selectedBlock.type]}</h2>
                </div>
                <div className="block-tools">
                  <button aria-label="Move up" disabled={selectedIndex === 0} onClick={() => moveBlock(selectedBlock.id, -1)} type="button"><ToolIcon name="up" /></button>
                  <button
                    aria-label="Move down"
                    disabled={selectedIndex === blocks.length - 1}
                    onClick={() => moveBlock(selectedBlock.id, 1)}
                    type="button"
                  >
                    <ToolIcon name="down" />
                  </button>
                  <button
                    aria-label="Duplicate"
                    disabled={full}
                    onClick={() => insertBlock({ ...structuredClone(selectedBlock), id: newBlockId() }, selectedIndex + 1)}
                    type="button"
                  >
                    <ToolIcon name="duplicate" />
                  </button>
                  <button aria-label="Remove" onClick={() => removeBlock(selectedBlock.id)} type="button"><ToolIcon name="trash" /></button>
                </div>
              </div>
              <div className="block-editor">
                <BlockEditor block={selectedBlock} onChange={updateBlock} />
              </div>
              <button className="secondary-button" onClick={() => selectBlock(null)} type="button">
                Done
              </button>
            </>
          ) : (
            <>
              <div className="builder-side-heading">
                <h2>Add a block</h2>
                {insertTarget !== null && (
                  <div className="block-tools">
                    <button aria-label="Cancel" onClick={() => setInsertTarget(null)} type="button"><ToolIcon name="remove" /></button>
                  </div>
                )}
              </div>
              <p className="builder-hint">{insertPosition()}</p>
              {full && <p className="builder-hint">This template has the maximum of {templateLimits.blocks} blocks.</p>}
              <BlockPalette
                disabled={full}
                onPick={(type) => insertBlock(createBlock(type), insertTarget ?? blocks.length)}
              />
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

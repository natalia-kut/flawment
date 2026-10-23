"use client";

import { useRef, useState, useTransition } from "react";
import { saveTemplate } from "@/lib/documents/actions";
import {
  assignmentFilterOptions,
  blockTypeOptions,
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
import DocumentSheet from "./document-sheet";

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

function blockSummary(block: TemplateBlock) {
  switch (block.type) {
    case "heading":
    case "text":
      return block.text.replace(/\s+/g, " ").slice(0, 60) || "Empty";
    case "facts":
      return `${block.facts.length} facts`;
    case "metrics":
      return `${block.metrics.length} figures`;
    case "taskTable":
    case "memberTable":
    case "statusChart":
    case "signatures":
      return block.title || "Untitled";
    case "pageBreak":
      return "New page in PDF";
  }
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
    case "statusChart":
      return <TitleField onChange={(title) => onChange({ ...block, title })} value={block.title} />;
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
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(source.blocks[0]?.id ?? null);
  const [error, setError] = useState("");
  const [isSaving, startSaving] = useTransition();

  const project = projects.find((item) => item.id === projectId) ?? projects.at(0);
  const draft: DocumentTemplate = { id: "draft", name: name.trim() || "Untitled template", description, blocks, isBuiltIn: false };

  function updateBlock(updated: TemplateBlock) {
    setBlocks((current) => current.map((block) => (block.id === updated.id ? updated : block)));
  }

  function insertBlock(block: TemplateBlock) {
    setBlocks((current) => {
      const index = current.findIndex((item) => item.id === selectedBlockId);
      return index === -1 ? [...current, block] : [...current.slice(0, index + 1), block, ...current.slice(index + 1)];
    });
    setSelectedBlockId(block.id);
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

  function removeBlock(id: string) {
    setBlocks((current) => current.filter((block) => block.id !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
  }

  function handleSave() {
    setError("");
    startSaving(async () => {
      const result = await saveTemplate(editingId, { name, description, blocks });
      if (result.ok) onSaved(result.value);
      else setError(result.error);
    });
  }

  return (
    <div className="builder">
      <header className="documents-heading">
        <div>
          <p className="eyebrow">WORKSPACE / DOCUMENTS / {editingId ? "EDIT" : "NEW"} TEMPLATE</p>
          <h1>{editingId ? "Edit template" : "Template builder"}</h1>
          <p className="section-description">
            Compose blocks, insert live project data and check the preview as you go.
          </p>
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

      <div className="documents-layout">
        <section className="builder-panel" aria-label="Template settings">
          <label className="builder-field">
            <span className="field-label">Template name</span>
            <input
              autoFocus
              maxLength={templateLimits.name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Weekly update for the faculty"
              value={name}
            />
          </label>
          <label className="builder-field">
            <span className="field-label">Description</span>
            <input
              maxLength={templateLimits.description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What is this document for?"
              value={description}
            />
          </label>

          <div className="template-list-heading">
            <span>Blocks</span>
            <span>{blocks.length}</span>
          </div>

          <ol className="block-list">
            {blocks.map((block, index) => {
              const isSelected = block.id === selectedBlockId;
              return (
                <li className={`block-item${isSelected ? " selected" : ""}`} key={block.id}>
                  <div className="block-item-heading">
                    <button
                      aria-expanded={isSelected}
                      className="block-toggle"
                      onClick={() => setSelectedBlockId(isSelected ? null : block.id)}
                      type="button"
                    >
                      <strong>{blockLabels[block.type]}</strong>
                      <span>{blockSummary(block)}</span>
                    </button>
                    <div className="block-tools">
                      <button aria-label="Move up" disabled={index === 0} onClick={() => moveBlock(block.id, -1)} type="button">↑</button>
                      <button
                        aria-label="Move down"
                        disabled={index === blocks.length - 1}
                        onClick={() => moveBlock(block.id, 1)}
                        type="button"
                      >
                        ↓
                      </button>
                      <button
                        aria-label="Duplicate"
                        disabled={blocks.length >= templateLimits.blocks}
                        onClick={() => insertBlock({ ...structuredClone(block), id: newBlockId() })}
                        type="button"
                      >
                        ⧉
                      </button>
                      <button aria-label="Remove" onClick={() => removeBlock(block.id)} type="button">×</button>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="block-editor">
                      <BlockEditor block={block} onChange={updateBlock} />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          <div className="template-list-heading">
            <span>Add block{selectedBlockId ? " after selected" : ""}</span>
          </div>
          <div className="block-palette">
            {blockTypeOptions.map((option) => (
              <button
                disabled={blocks.length >= templateLimits.blocks}
                key={option.type}
                onClick={() => insertBlock(createBlock(option.type))}
                type="button"
              >
                <strong>{option.label}</strong>
                <span>{option.hint}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="document-preview-area" aria-label="Live preview">
          <div className="preview-toolbar">
            <div>
              <p className="eyebrow">LIVE PREVIEW</p>
              <h2>{draft.name}</h2>
            </div>
            {project && (
            <select
              aria-label="Preview with project"
              className="project-select compact"
              onChange={(event) => onProjectChange(Number(event.target.value))}
              value={project.id}
            >
              {projects.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            )}
          </div>
          {project ? (
            <DocumentSheet project={project} template={draft} today={today} />
          ) : (
            <p className="builder-hint">Create a project to see a live preview.</p>
          )}
        </section>
      </div>
    </div>
  );
}

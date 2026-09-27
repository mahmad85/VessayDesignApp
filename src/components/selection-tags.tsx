'use client';
import { useState } from 'react';
import { ChevronDown, Pencil } from 'lucide-react';
import type { BranchId, OutlineBranch } from '@/modules/configuration/design-outline';

/**
 * Every current choice as an editable tag, one hierarchy branch at a time so
 * twenty-plus selections stay readable. Selecting a tag opens its editor.
 */
export function SelectionTags({
  outline,
  activeLeaf,
  onEdit,
}: {
  outline: OutlineBranch[];
  activeLeaf?: string;
  onEdit: (leafId: string, branchId: BranchId) => void;
}) {
  const activeBranch = outline.find((branch) =>
    branch.leaves.some((leaf) => leaf.id === activeLeaf),
  )?.id;
  const [picked, setPicked] = useState<{ branch: BranchId; follow?: string }>({
    branch: 'essentials',
  });
  const [open, setOpen] = useState(true);
  // Follow the latest focused choice until the customer picks another group.
  const current =
    activeBranch && picked.follow !== activeLeaf && activeLeaf
      ? activeBranch
      : outline.some((branch) => branch.id === picked.branch)
        ? picked.branch
        : 'essentials';
  const branch = outline.find((item) => item.id === current) ?? outline[0];
  const total = outline.reduce((sum, item) => sum + item.leaves.length, 0);
  const personalised = outline.reduce(
    (sum, item) => sum + item.leaves.filter((leaf) => leaf.customized).length,
    0,
  );
  return (
    <section className={`selection-tags ${open ? 'open' : ''}`} aria-label="Your selections">
      <div className="tags-header">
        <button
          className="tags-toggle"
          aria-expanded={open}
          aria-controls="selection-tag-list"
          onClick={() => setOpen((value) => !value)}
        >
          <strong>Your selections</strong>
          <span>
            {total} choices · {personalised} personalised
          </span>
          <ChevronDown size={14} />
        </button>
        <div className="tags-groups" role="group" aria-label="Selection group">
          {outline.map((item) => (
            <button
              key={item.id}
              aria-pressed={item.id === branch.id}
              onClick={() => {
                setOpen(true);
                setPicked({ branch: item.id, follow: activeLeaf });
              }}
            >
              {item.id === 'essentials' ? 'Essentials' : item.label}
              <span>{item.leaves.length}</span>
            </button>
          ))}
        </div>
      </div>
      {open && (
        <ul className="tag-list" id="selection-tag-list" aria-label={`${branch.label} selections`}>
          {branch.leaves.map((leaf, index) => {
            const previousSection = branch.leaves[index - 1]?.section;
            return (
              <li key={leaf.id} className={leaf.section !== previousSection ? 'section-start' : ''}>
                {leaf.section && leaf.section !== previousSection && (
                  <span className="tag-section">{leaf.section}</span>
                )}
                <button
                  className={`tag ${leaf.customized ? 'customized' : ''} ${leaf.id === activeLeaf ? 'active' : ''}`}
                  aria-label={`${leaf.label}: ${leaf.value}. Edit`}
                  title={`${leaf.label}: ${leaf.value}`}
                  onClick={() => onEdit(leaf.id, leaf.branchId)}
                >
                  {leaf.swatch && (
                    <span className="tiny-swatch" style={{ background: leaf.swatch }} />
                  )}
                  <span className="tag-label">{leaf.label}</span>
                  <span className="tag-value">{leaf.value}</span>
                  <Pencil size={11} aria-hidden className="tag-edit" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

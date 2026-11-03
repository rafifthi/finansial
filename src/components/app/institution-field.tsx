"use client";

import { ComboBox, ComboBoxItem } from "@/components/base/combobox/combobox";
import { detectInstitution, INSTITUTIONS } from "@/lib/finance/institutions";
import type { Account } from "@/lib/sheets/schema";
import { AccountLogo } from "./account-logo";

const AUTO = "__auto";
const SORTED = [...INSTITUTIONS].sort((a, b) => a.name.localeCompare(b.name));

/**
 * Searchable bank / app picker for an account's logo. Empty means "detect
 * from the name"; the hint says what that currently finds.
 */
export function InstitutionField({
  label,
  name,
  type,
  value,
  onChange,
}: {
  label: string;
  name: string;
  type: Account["type"];
  value: string;
  onChange: (value: string) => void;
}) {
  const detected = detectInstitution(name);
  const items = [
    { id: AUTO, label: "Detect from the name", institution: "" },
    ...SORTED.map((i) => ({ id: i.id, label: i.name, institution: i.id })),
    { id: "none", label: "None (show the type icon)", institution: "none" },
  ];

  return (
    <ComboBox
      label={label}
      placeholder="Search banks and apps"
      defaultItems={items}
      selectedKey={value || AUTO}
      onSelectionChange={(key) => key != null && onChange(key === AUTO ? "" : String(key))}
      hint={
        value
          ? undefined
          : detected
            ? `Found in the name: ${detected.name}.`
            : "Nothing found in the name, so the type icon is shown."
      }
    >
      {(item) => (
        <ComboBoxItem id={item.id} textValue={item.label}>
          <AccountLogo account={{ name: item.id === AUTO ? name : "", institution: item.institution, type }} size="sm" />
          <span className="truncate">{item.label}</span>
        </ComboBoxItem>
      )}
    </ComboBox>
  );
}

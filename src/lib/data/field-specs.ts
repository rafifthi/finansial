import type { FieldSpec } from "@/components/app/entity-form";
import type { AppData } from "./app-data";

/** Form layouts per table, built from live option lists. */
export function fieldSpecs(data: AppData) {
  const expenseCategories = data.categories
    .filter((c) => !c.archived && c.kind === "expense")
    .map((c) => ({ id: c.id, label: `${c.name} · ${c.group}` }));
  const allCategories = data.categories.filter((c) => !c.archived).map((c) => ({ id: c.id, label: `${c.name} · ${c.group}` }));
  // Income can't be moved between categories.
  const transferCategories = data.categories
    .filter((c) => !c.archived && c.kind === "expense")
    .map((c) => ({ id: c.id, label: `${c.name} · ${c.group}` }));

  const categories: FieldSpec[] = [
    { name: "name", label: "Name", type: "text", placeholder: "e.g. Meals", required: true },
    { name: "emoji", label: "Look", type: "identity" },
    {
      name: "group",
      label: "Group",
      type: "segmented",
      options: ["Needs", "Wants", "Savings", "Income"].map((g) => ({ id: g, label: g })),
    },
    {
      name: "starting_balance",
      label: "Starting balance",
      type: "money",
      hint: "What this pot already held before you tracked it here.",
      showWhen: { field: "group", in: ["Savings"] },
    },
    {
      name: "target_amount",
      label: "Target",
      type: "money",
      hint: "Optional. What you're saving toward in this pot.",
      showWhen: { field: "group", in: ["Savings"] },
    },
    {
      name: "target_date",
      label: "Target date",
      type: "date",
      hint: "Optional. Sets the monthly amount you need to save.",
      showWhen: { field: "group", in: ["Savings"] },
    },
    { name: "archived", label: "Archived (hide from forms)", type: "checkbox" },
  ];

  const installments: FieldSpec[] = [
    { name: "name", label: "Name", type: "text", placeholder: "e.g. Cicilan Mobil", required: true },
    { name: "monthly_amount", label: "Per month", type: "money", required: true },
    { name: "tenor_months", label: "Number of months", type: "number", min: 1, max: 120, required: true },
    { name: "start_month", label: "First payment", type: "month", required: true },
    { name: "total_amount", label: "Total", type: "money", hint: "Leave empty to use per month × number of months." },
    { name: "category_id", label: "Category", type: "select", options: expenseCategories, allowEmpty: "None", searchable: true },
    { name: "note", label: "Note", type: "text" },
  ];

  const notTransfer = { field: "type", in: ["expense", "income"] };
  const transfer = { field: "type", in: ["transfer"] };
  const recurring: FieldSpec[] = [
    {
      name: "type",
      label: "Type",
      type: "segmented",
      options: [
        { id: "expense", label: "Expense" },
        { id: "income", label: "Income" },
        { id: "transfer", label: "Transfer" },
      ],
    },
    { name: "amount", label: "Amount", type: "money", required: true },
    { name: "description", label: "Name", type: "text", placeholder: "e.g. Wifi", required: true },
    { name: "category_id", label: "Category", type: "select", options: allCategories, allowEmpty: "None", searchable: true, showWhen: notTransfer, requiredWhen: notTransfer },
    { name: "from_category_id", label: "From category", type: "select", options: transferCategories, searchable: true, showWhen: transfer, required: true, hint: "Its budget goes down by the amount." },
    { name: "category_id", label: "To category", type: "select", options: transferCategories, searchable: true, showWhen: transfer, required: true, hint: "Its budget (or savings pot) goes up by the amount." },
    { name: "schedule", label: "Schedule", type: "heading" },
    { name: "frequency", label: "Repeats", type: "schedule" },
    { name: "start_date", label: "Starts", type: "date", required: true },
    { name: "end_date", label: "Ends", type: "date", hint: "Optional. Leave empty to keep it going." },
    { name: "details", label: "Details", type: "heading" },
    { name: "member", label: "Member", type: "select", options: data.members.map((m) => ({ id: m, label: m })), allowEmpty: "Household" },
    {
      name: "installment_id",
      label: "Pays installment",
      type: "select",
      options: data.installments.map((i) => ({ id: i.id, label: i.name })),
      allowEmpty: "None",
      showWhen: { field: "type", in: ["expense"] },
    },
    {
      name: "preview",
      label: "Preview",
      type: "recurring-preview",
      categories: data.categories.map((c) => ({ id: c.id, label: c.name })),
    },
  ];

  return { categories, installments, recurring };
}

"use client";

import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { type RemixiconComponentType, RiBook2Line, RiPaletteLine, RiPriceTag3Line, RiUserLine } from "@remixicon/react";
import { Tab, TabList, TabPanel, Tabs } from "@/components/base/tabs/tabs";

/** Icons are looked up here: component references can't be passed from the server. */
const ICONS = {
  account: RiUserLine,
  appearance: RiPaletteLine,
  book: RiBook2Line,
  categories: RiPriceTag3Line,
} satisfies Record<string, RemixiconComponentType>;

export interface SettingsSection {
  id: keyof typeof ICONS;
  label: string;
  content: ReactNode;
}

/**
 * Settings sections as tabs. The open tab lives in `?tab=` so links (the
 * sidebar avatar, budget → categories) can deep-link; switching tabs swaps the
 * query in place without a server round trip.
 */
export function SettingsTabs({ sections }: { sections: SettingsSection[] }) {
  const params = useSearchParams();
  const requested = params.get("tab");
  const selected = sections.some((s) => s.id === requested) ? requested! : sections[0].id;

  const select = (key: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("tab", key);
    // Section-specific params (e.g. ?group= highlighting) don't carry over.
    if (key !== "categories") next.delete("group");
    window.history.replaceState(null, "", `?${next.toString()}`);
  };

  return (
    <Tabs selectedKey={selected} onSelectionChange={(key) => select(String(key))}>
      {/* Icons drop on phones so all four tabs fit without scrolling. */}
      <TabList aria-label="Settings sections" items={sections}>
        {(s) => (
          <Tab id={s.id} icon={ICONS[s.id]} className="max-sm:px-2 max-sm:[&_svg]:hidden">
            {s.label}
          </Tab>
        )}
      </TabList>
      {sections.map((s) => (
        <TabPanel key={s.id} id={s.id} className="flex flex-col gap-4">
          {s.content}
        </TabPanel>
      ))}
    </Tabs>
  );
}

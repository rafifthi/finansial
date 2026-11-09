"use client";

import type { ComponentType } from "react";
import { ReactRenderer } from "@tiptap/react";
import type { SuggestionKeyDownProps, SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";

/** What a suggestion list exposes to the editor: arrow keys and Enter go to it while typing continues in the page. */
export interface SuggestionHandle {
  onKeyDown: (e: KeyboardEvent) => boolean;
}

let popups = 0;

/**
 * Mounts a suggestion list (the / menu, @mentions) at the cursor. The editor
 * keeps focus and points at the list (aria-controls / aria-expanded), and
 * the list sets aria-activedescendant on it as the highlight moves.
 */
export function suggestionPopup<I, P extends object>(List: ComponentType<P>, prefix: string): NonNullable<SuggestionOptions<I, I>["render"]> {
  return () => {
    let renderer: ReactRenderer<SuggestionHandle, P> | undefined;
    let unmount: (() => void) | undefined;
    const id = `${prefix}-${++popups}`;
    const point = (props: SuggestionProps<I, I>, on: boolean) => {
      const dom = props.editor.view.dom;
      if (on) {
        dom.setAttribute("aria-controls", id);
        dom.setAttribute("aria-expanded", "true");
      } else {
        dom.removeAttribute("aria-controls");
        dom.removeAttribute("aria-expanded");
        dom.removeAttribute("aria-activedescendant");
      }
    };
    return {
      onStart: (props) => {
        renderer = new ReactRenderer(List, { props: { ...props, id } as unknown as P, editor: props.editor });
        unmount = props.mount(renderer.element as HTMLElement);
        point(props, true);
      },
      onUpdate: (props) => renderer?.updateProps({ ...props, id } as unknown as P),
      onKeyDown: (props: SuggestionKeyDownProps) => renderer?.ref?.onKeyDown(props.event) ?? false,
      onExit: (props) => {
        point(props, false);
        unmount?.();
        renderer?.destroy();
        renderer = undefined;
      },
    };
  };
}

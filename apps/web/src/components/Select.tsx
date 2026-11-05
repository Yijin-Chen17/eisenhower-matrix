import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";

export interface SelectOption {
  value: string;
  label: string;
  /** Small trailing note, e.g. a count. */
  hint?: string;
  /** Optional color for the leading dot. */
  dot?: string;
  /** Square marks read as a matrix, circles as a single quadrant. */
  dotShape?: "square" | "circle";
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  label: string;
  align?: "left" | "right";
  className?: string;
  /** Rendered before the label inside the trigger, e.g. a quadrant mark. */
  leading?: ReactNode;
}

const MENU_MIN_WIDTH = 208;
const MENU_GAP = 6;

interface MenuPosition {
  top: number;
  left: number;
  width: number;
}

export function Select({
  value,
  options,
  onChange,
  label,
  align = "right",
  className = "",
  leading
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );
  const selected = options[selectedIndex];

  const close = useCallback(() => {
    setOpen(false);
    setPosition(null);
  }, []);

  const openMenu = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const width = Math.max(rect.width, MENU_MIN_WIDTH);
    const left =
      align === "right" ? rect.right - width : rect.left;
    const maxLeft = window.innerWidth - width - 8;

    setPosition({
      top: rect.bottom + MENU_GAP,
      left: Math.min(Math.max(8, left), Math.max(8, maxLeft)),
      width
    });
    setActiveIndex(selectedIndex);
    setOpen(true);
  }, [align, selectedIndex]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      close();
    };
    const onScroll = () => close();

    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const node = menuRef.current?.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`
    );
    node?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const commit = (index: number) => {
    const option = options[index];
    if (option && option.value !== value) onChange(option.value);
    close();
    triggerRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();
        openMenu();
      }
      return;
    }

    switch (event.key) {
      case "Escape":
        event.preventDefault();
        close();
        break;
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) => Math.min(options.length - 1, index + 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((index) => Math.max(0, index - 1));
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        commit(activeIndex);
        break;
      case "Tab":
        close();
        break;
      default:
        break;
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`select${open ? " open" : ""}${className ? ` ${className}` : ""}`}
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-activedescendant={
          open ? `${menuId}-option-${activeIndex}` : undefined
        }
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
      >
        {leading}
        <span className="select-value">{selected?.label ?? ""}</span>
        {selected?.hint && <span className="select-hint">{selected.hint}</span>}
        <svg
          className="select-chevron"
          viewBox="0 0 16 16"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            className="select-menu"
            role="listbox"
            aria-label={label}
            style={
              {
                top: position.top,
                left: position.left,
                width: position.width
              } as CSSProperties
            }
          >
            {options.map((option, index) => (
              <div
                key={option.value}
                id={`${menuId}-option-${index}`}
                role="option"
                aria-selected={option.value === value}
                data-index={index}
                className={`select-option${
                  index === activeIndex ? " active" : ""
                }${option.value === value ? " selected" : ""}`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  commit(index);
                }}
              >
                {option.dot && (
                  <i
                    className={`select-dot ${option.dotShape ?? "circle"}`}
                    style={{ background: option.dot }}
                    aria-hidden="true"
                  />
                )}
                <span className="select-option-label">{option.label}</span>
                {option.hint && (
                  <span className="select-option-hint">{option.hint}</span>
                )}
                {option.value === value && (
                  <svg
                    className="select-check"
                    viewBox="0 0 16 16"
                    width="12"
                    height="12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path
                      d="m3.5 8.5 3 3 6-7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}

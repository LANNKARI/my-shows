"use client";

import { useState, type ComponentProps } from "react";

type Props = Omit<ComponentProps<"input">, "type">;
export default function PasswordInput({
  id,
  className = "input",
  ...props
}: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        {...props}
        id={id}
        type={visible ? "text" : "password"}
        className={`${className} pr-24`}
      />
      <button
        type="button"
        aria-controls={id}
        aria-pressed={visible}
        aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
        onClick={() => setVisible((value) => !value)}
        className="absolute inset-y-0 right-0 min-w-20 px-3 text-xs font-semibold text-neutral-300 hover:text-white focus-visible:outline-2 focus-visible:outline-rose-400 rounded-xl"
      >
        {visible ? "Скрыть" : "Показать"}
      </button>
    </div>
  );
}

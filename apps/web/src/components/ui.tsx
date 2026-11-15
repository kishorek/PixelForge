import * as Dialog from "@radix-ui/react-dialog";
import * as Progress from "@radix-ui/react-progress";
import * as Switch from "@radix-ui/react-switch";
import * as Tooltip from "@radix-ui/react-tooltip";
import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react";

export type ButtonVariant = "default" | "primary" | "ghost" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "default",
    size = "md",
    loading = false,
    icon,
    block = false,
    className = "",
    children,
    disabled,
    ...rest
  },
  ref,
) {
  const classes = [
    "btn",
    variant !== "default" ? `btn--${variant}` : "",
    size !== "md" ? `btn--${size}` : "",
    block ? "btn--block" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      ref={ref}
      type="button"
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="spinner" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
}

export function IconButton({
  label,
  active = false,
  className = "",
  children,
  ...rest
}: IconButtonProps) {
  return (
    <Tooltip.Root delayDuration={350}>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          className={["icon-btn", active ? "icon-btn--active" : "", className]
            .filter(Boolean)
            .join(" ")}
          {...rest}
        >
          {children}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="tooltip" sideOffset={6} collisionPadding={8}>
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function Field({
  label,
  htmlFor,
  value,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  value?: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      {htmlFor ? (
        <label className="field__label" htmlFor={htmlFor}>
          <span>{label}</span>
          {value !== undefined ? <span className="field__value">{value}</span> : null}
        </label>
      ) : (
        <span className="field__label">
          <span>{label}</span>
          {value !== undefined ? <span className="field__value">{value}</span> : null}
        </span>
      )}
      {children}
      {hint ? <span className="field__hint">{hint}</span> : null}
      {error ? <span className="field__error">{error}</span> : null}
    </div>
  );
}

export interface RangeFieldProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  hint?: ReactNode;
  disabled?: boolean;
}

export function RangeField({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  hint,
  disabled,
}: RangeFieldProps) {
  return (
    <Field label={label} htmlFor={id} value={format ? format(value) : value} hint={hint}>
      <div className="range-row">
        <input
          id={id}
          className="range"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <input
          className="input input--mono"
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-label={`${label} numeric value`}
          onChange={(event) => {
            const next = event.target.valueAsNumber;
            if (Number.isFinite(next)) onChange(next);
          }}
        />
      </div>
    </Field>
  );
}

export function NumberField({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  suffix,
  hint,
  disabled,
  error,
}: {
  id: string;
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  suffix?: string;
  hint?: ReactNode;
  disabled?: boolean;
  error?: string;
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error}>
      <div className="input-group">
        <input
          id={id}
          className="input input--mono"
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            const next = event.target.valueAsNumber;
            if (Number.isFinite(next)) onChange(next);
          }}
        />
        {suffix ? <span className="input-affix">{suffix}</span> : null}
      </div>
    </Field>
  );
}

export function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  mono,
  maxLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: ReactNode;
  mono?: boolean;
  maxLength?: number;
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <input
        id={id}
        className={`input${mono ? " input--mono" : ""}`}
        type="text"
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

export function ColorField({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <div className="row">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={{
            width: 46,
            height: 38,
            padding: 2,
            border: "1px solid var(--line-strong)",
            borderRadius: 4,
            background: "var(--surface)",
          }}
        />
        <input
          className="input input--mono"
          style={{ flex: "1 1 120px" }}
          type="text"
          value={value}
          aria-label={`${label} hex value`}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </Field>
  );
}

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  hint,
  disabled,
}: {
  id: string;
  label: string;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <select
        id={id}
        className="select"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function SwitchRow({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="switch-row">
      <div className="switch-row__text">
        <label className="switch-row__label" htmlFor={id}>
          {label}
        </label>
        {description ? <span className="field__hint">{description}</span> : null}
      </div>
      <Switch.Root
        id={id}
        className="switch"
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      >
        <Switch.Thumb className="switch__thumb" />
      </Switch.Root>
    </div>
  );
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="segmented" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="segmented__item"
          aria-pressed={option.value === value}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}

export function Alert({
  tone = "info",
  title,
  children,
  onDismiss,
}: {
  tone?: "info" | "ok" | "warn" | "danger";
  title?: string;
  children?: ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div className="alert" data-tone={tone} role={tone === "danger" ? "alert" : "status"}>
      <div className="spread">
        {title ? <span className="alert__title">{title}</span> : <span />}
        {onDismiss ? (
          <button type="button" className="btn btn--ghost btn--sm" onClick={onDismiss}>
            Dismiss
          </button>
        ) : null}
      </div>
      {children ? <div>{children}</div> : null}
    </div>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "accent" | "ok" | "warn" | "danger";
}) {
  return <span className={`badge${tone === "default" ? "" : ` badge--${tone}`}`}>{children}</span>;
}

export function Spinner({ label = "Working" }: { label?: string }) {
  return (
    <output className="row" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span className="visually-hidden">{label}</span>
    </output>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <Progress.Root className="progress" value={value} aria-label={label}>
      <Progress.Indicator className="progress__indicator" style={{ width: `${value}%` }} />
    </Progress.Root>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon ? <div className="empty__icon">{icon}</div> : null}
      <div className="empty__title">{title}</div>
      {children ? <div className="empty__body">{children}</div> : null}
      {action}
    </div>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmVariant = "danger",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: ButtonVariant;
  onConfirm: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <Dialog.Title className="dialog-title">{title}</Dialog.Title>
          <Dialog.Description className="dialog-desc">{description}</Dialog.Description>
          <div className="dialog-actions">
            <Dialog.Close asChild>
              <Button>Cancel</Button>
            </Dialog.Close>
            <Button
              variant={confirmVariant}
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export type IconName = "delete" | "duplicate" | "edit" | "enter" | "logout" | "new" | "save" | "settings" | "upload";

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="button-icon" aria-hidden="true">
      <use href={`/icons.svg#icon-${name}`} />
    </svg>
  );
}

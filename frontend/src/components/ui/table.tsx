import type {
  HTMLAttributes,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";

import styles from "./primitives.module.css";

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  caption?: string;
}

export function Table({ caption, className, children, ...props }: TableProps) {
  const classes = [styles.table, className].filter(Boolean).join(" ");

  return (
    <div
      className={styles.tableFrame}
      role="region"
      aria-label={
        caption
          ? `${caption} — เลื่อนแนวนอนได้เมื่อหน้าจอแคบ`
          : "ตารางข้อมูล — เลื่อนแนวนอนได้เมื่อหน้าจอแคบ"
      }
      tabIndex={0}
    >
      <table className={classes} {...props}>
        {caption ? <caption className={styles.tableCaption}>{caption}</caption> : null}
        {children}
      </table>
    </div>
  );
}

export function TableHead(props: HTMLAttributes<HTMLTableSectionElement>) {
  const classes = [styles.tableHead, props.className].filter(Boolean).join(" ");
  return <thead {...props} className={classes} />;
}

export function TableBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function TableRow(props: HTMLAttributes<HTMLTableRowElement>) {
  const classes = [styles.tableBodyRow, props.className].filter(Boolean).join(" ");
  return <tr {...props} className={classes} />;
}

export function TableHeaderCell(props: ThHTMLAttributes<HTMLTableCellElement>) {
  const classes = [styles.tableHeaderCell, props.className].filter(Boolean).join(" ");
  return <th {...props} scope={props.scope ?? "col"} className={classes} />;
}

export function TableCell(props: TdHTMLAttributes<HTMLTableCellElement>) {
  const classes = [styles.tableCell, props.className].filter(Boolean).join(" ");
  return <td {...props} className={classes} />;
}

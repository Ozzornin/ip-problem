import { Table } from "@/utils/table";
import {
  ConfigOptions,
  Fraction,
  add,
  all,
  create,
  isInteger,
  multiply,
  number,
} from "mathjs";
import React from "react";
import styles from "./simplextable.module.scss";
interface SimplexTableProps {
  table: Table;
}
const config: ConfigOptions = {
  number: "Fraction",
};
const math = create(all, config);

function formatNumber(num: Fraction): string {
  try {
    if (isInteger(num)) {
      return number(num).toString();
    }
    return math.format(num);
  } catch (e) {
    return "error";
  }
}

export default function SimplexTable({ table }: SimplexTableProps) {
  // create a mathjs instance with everything included

  console.log(math.format(number(table.c[0].value)));
  let delta = table.b.map((b, i) => {
    multiply(b, table.basis[i].value);
  });

  return (
    <div>
      <table className={styles.table}>
        <tr className={styles.c_col}>
          <td>C</td>
          <td>-</td>
          {table.c?.map((c, i) => (
            <td
              key={`c${i}`}
              className={table.pivot_column == i ? styles.pivot : ""}
            >{`${formatNumber(c?.value)}`}</td>
          ))}
        </tr>
        <tr className={styles.b_col}>
          <td>B</td>
          <td>A0</td>
          {table.c?.map((c, i) => (
            <td
              key={`${c.name}`}
              className={table.pivot_column == i ? styles.pivot : ""}
            >
              {c?.name}
            </td>
          ))}
        </tr>
        {table.basis?.map((row, i) => (
          <tr
            key={`row${i}`}
            className={
              table.pivot_row == i ? styles.pivot_matrix : styles.matrix
            }
          >
            <td>{row.name}</td>
            <td>{formatNumber(table.b[i])}</td>
            {table.A[i]?.map((num, j) => (
              <td
                key={`value${j}`}
                className={table.pivot_column == j ? styles.pivot : ""}
              >{`${formatNumber(num)}`}</td>
            ))}
          </tr>
        ))}
        <tr className={styles.delta}>
          <td>Δ</td>
          <td>{formatNumber(table.result)}</td>
          {table.delta?.map((delta, i) => (
            <td
              key={`delta${i}`}
              className={table.pivot_column == i ? styles.pivot : ""}
            >{`${formatNumber(delta)}`}</td>
          ))}
        </tr>
      </table>
    </div>
  );
}

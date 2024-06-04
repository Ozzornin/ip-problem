import React from "react";
import styles from "./signInput.module.scss";
interface SignInputProps {
  setSign: (row: number, col: number, val: string) => void;
  row: number;
  col: number;
  value: string;
}

export default function SignInput({
  setSign,
  row,
  col,
  value,
}: Readonly<SignInputProps>) {
  const signs: Array<string> = ["<=", ">=", "="];

  return (
    <select
      className={styles.sign}
      onChange={(e) => setSign(row, col, e.currentTarget.value)}
    >
      <option value={""}></option>
      {signs.map((sign, key) => (
        <option value={sign} key={key + 1}>
          {sign}
        </option>
      ))}
    </select>
  );
}

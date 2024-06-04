"use client";

import React from "react";
import styles from "./numberInput.module.scss";
interface NumberInputProps {
  setMatrix: (row: number, col: number, val: number) => void; // replace 'number' with the actual type of numberState
  row: number;
  col: number;
  value: number;
}

export default function NumberInput({
  setMatrix,
  row,
  col,
  value,
}: NumberInputProps): JSX.Element {
  return (
    <>
      <input
        className={styles.numInput}
        type="text"
        name="number"
        value={value}
        onChange={(e) => setMatrix(row, col, parseInt(e.target.value))}
      />
      <label htmlFor="number" className={styles.label}>
        x{col + 1}
      </label>
    </>
  );
}

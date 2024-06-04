"use client";

import React, { useEffect } from "react";
import styles from "./equalinput.module.scss";

interface EqualInputProps {
  setMatrix: (row: number, col: number, val: any) => void; // replace 'number' with the actual type of numberState
  row: number;
  col: number;
  value: number;
}

export default function EqualInput({
  setMatrix,
  row,
  col,
  value,
}: Readonly<EqualInputProps>): JSX.Element {
  return (
    <input
      className={styles.eqlInp}
      type="text"
      name="number"
      value={value}
      onChange={(e) => setMatrix(row, col, parseInt(e.target.value))}
    />
  );
}

"use client";

import React, { useEffect, useState } from "react";
import styles from "./simplex.module.scss";
import NumberInput from "./numberInput/NumberInput";
import SignInput from "./signInput/SignInput";
import EqualInput from "./equalInput/EqualInput";
import ObjInput from "./objFunction/ObjInput";
import { MinMaxFunction } from "../utils/enums";
import { Matrix, SimplexMethod, Vector } from "@/utils/simplex";
import { all, create, format, fraction, ConfigOptions } from "mathjs";
export default function Simplex() {
  const config: ConfigOptions = {
    number: "Fraction",
  };

  // create a mathjs instance with everything included
  const math = create(all, config);

  const nums: Array<number> = [
    2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  ];
  const [vector, setVector] = React.useState<MinMaxFunction>(
    MinMaxFunction.Max
  );
  const [numOfVariables, setNumOfVariables] = React.useState<number>(4);
  const [numOfConstraints, setNumOfConstraints] = React.useState<number>(2);
  const [objectiveFunction, setObjectiveFunction] = React.useState<
    Array<number>
  >([]);
  const [matrix, setMatrix] = useState(
    Array(numOfConstraints)
      .fill(0)
      .map(() => Array(numOfVariables + 2).fill(0))
  );

  const updateMatrixValue = (row: number, col: number, value: any) => {
    const newMatrix = matrix.map((r, rowIndex) =>
      r.map((c, colIndex) => (rowIndex === row && colIndex === col ? value : c))
    );
    setMatrix(newMatrix);
  };

  const updateObjectiveFunction = (col: number, value: number) => {
    const newObjectiveFunction = objectiveFunction.map((val, index) =>
      index === col ? value : val
    );
    setObjectiveFunction(newObjectiveFunction);
  };

  useEffect(() => {
    const newMatrix = Array(numOfConstraints)
      .fill(0)
      .map(() => Array(numOfVariables).fill(0));
    const newObjectiveFunction = Array(numOfVariables - 2).fill(0);
    setObjectiveFunction(newObjectiveFunction);
    setMatrix(newMatrix);
  }, [numOfConstraints, numOfVariables]);

  return (
    <>
      <div className={styles.numOfVariables}>
        <label htmlFor="numOfVariables">Кількість змінних: </label>
        <select
          id="numOfVariables"
          onChange={(e) => setNumOfVariables(parseInt(e.target.value) + 2)}
        >
          {nums.map((num, index) => (
            <option value={num} key={"key" + index}>
              {num}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.numOfConstraints}>
        <label htmlFor="numOfConstraints">Кількість обмежень: </label>
        <select
          id="numOfConstraints"
          onChange={(e) => setNumOfConstraints(parseInt(e.target.value))}
        >
          {nums.map((num, index) => (
            <option value={num} key={index + 212}>
              {num}
            </option>
          ))}
        </select>
      </div>
      <div>
        <button
          onClick={() => {
            console.log(matrix);
            const c_vec: Vector = objectiveFunction;
            const b_vec: Vector = matrix.map((row) => row[row.length - 1]);
            const a_matrix: Matrix = matrix.map((row) =>
              row.slice(0, row.length - 2)
            );
            const constraint_types = matrix.map((row) => row[row.length - 2]);
            const simplex: SimplexMethod = new SimplexMethod(
              c_vec,
              a_matrix,
              b_vec,
              constraint_types
            );
            let frac = fraction("10/3");
            let frac1 = fraction(3);
            console.log(math.format(fraction(1, 3)));
            console.log(frac.toString());
            console.log(math.format(frac));
            console.log(`${frac.d}-d, ${frac.n}-n, ${frac.s}-s`);
            try {
              simplex.solve();
            } catch (e) {
              console.log(e);
            }
          }}
        >
          Click me
        </button>
      </div>
      <div>
        {objectiveFunction.map((value, index) => (
          <>
            {index != 0 ? "+" : ""}
            <ObjInput
              key={index + "obj"}
              index={index}
              value={value}
              setObjFunc={updateObjectiveFunction}
            ></ObjInput>
          </>
        ))}
        {"->"}
        <select
          onChange={(e) => setVector(e.currentTarget.value as MinMaxFunction)}
        >
          <option value={MinMaxFunction.Max}>max</option>
          <option value={MinMaxFunction.Min}>min</option>
        </select>
      </div>
      <div>
        {matrix.map((row, rowIndex) => (
          <div key={`hello${rowIndex}`} className={styles.constraint}>
            {row.map((value, colIndex) => {
              let inputComponent;
              if (colIndex === row.length - 2) {
                inputComponent = (
                  <SignInput
                    key={`${rowIndex}-${colIndex}`}
                    row={rowIndex}
                    col={colIndex}
                    value={value}
                    setSign={updateMatrixValue}
                  />
                );
              } else if (colIndex === row.length - 1) {
                inputComponent = (
                  <EqualInput
                    key={`${rowIndex}-${colIndex}`}
                    row={rowIndex}
                    col={colIndex}
                    value={value}
                    setMatrix={updateMatrixValue}
                  />
                );
              } else {
                inputComponent = (
                  <>
                    {colIndex != 0 ? "+" : ""}
                    <NumberInput
                      key={`${rowIndex}-${colIndex}`}
                      row={rowIndex}
                      col={colIndex}
                      value={value}
                      setMatrix={updateMatrixValue}
                    />
                  </>
                );
              }
              return inputComponent;
            })}
          </div>
        ))}
      </div>
    </>
  );
}

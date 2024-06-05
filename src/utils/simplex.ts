import { MarkOptions } from "perf_hooks";
import { MinMaxFunction, VarType } from "./enums";
import { FractionNum, VarNum } from "./varnum";
import {
  create,
  all,
  fraction,
  add,
  multiply,
  subtract,
  Fraction,
  divide,
  Unit,
  number,
  re,
  to,
  format,
  isInteger,
  floor,
} from "mathjs";
import { Table } from "./table";

enum LogMode {
  LOG_OFF,
  MEDIUM_LOG,
  FULL_LOG,
}

export interface Vector extends Array<any> {}
export interface Matrix extends Array<Vector> {}

export class SimplexMethod {
  private c_vec: Vector;
  private a_matrix: Matrix;
  private b_vec: Vector;
  private log_mode: LogMode;
  private table: SimplexTable;
  private constraint_types: string[];
  private _num_vars: number;
  private _num_constraints: number;
  private _basis: Vector = [];
  private _tables: Table[] = [];

  constructor(
    func_vec: Vector,
    conditions_matrix: Matrix,
    constraints_vec: Vector,
    constraint_types: string[],
    log_mode: LogMode = LogMode.LOG_OFF
  ) {
    // ВЕКТОР ФУНКЦІЇ
    this.c_vec = func_vec.map(
      (val, index) =>
        new FractionNum(VarType.Regular, fraction(val), `x${index + 1}`)
    );
    // МАТРИЦЯ УМОВ
    this.a_matrix = conditions_matrix.map((row) =>
      row.map((val) => fraction(val))
    );
    // ВЕКТОР УМОВ
    this.b_vec = constraints_vec.map((val) => fraction(val));
    // ЗНАК УМОВ
    this.constraint_types = constraint_types;

    this.log_mode = log_mode;

    this._num_vars = this.c_vec.length;
    this._num_constraints = this.a_matrix.length;
    this.table = new SimplexTable(this.c_vec, this.a_matrix, this.b_vec, []);
    this._initialize_simplex_table();
  }

  private _initialize_simplex_table() {
    // Add slack and artificial variables
    for (let i = 0; i < this._num_constraints; i++) {
      let slack: Vector = new Array(this._num_constraints).fill(fraction(0));
      slack[i] = fraction(1);

      if (this.constraint_types[i] === "<=") {
        this.a_matrix = this.a_matrix.map((row, rowIndex) =>
          row.concat(slack[rowIndex])
        );
        this.c_vec.push(
          new FractionNum(VarType.Slack, fraction(0), `s${i + 1}`)
        );
        this._basis.push(
          new FractionNum(VarType.Slack, fraction(0), `s${i + 1}`)
        );
      } else if (this.constraint_types[i] === ">=") {
        this.a_matrix = this.a_matrix.map((row, rowIndex) =>
          row.concat(multiply(slack[rowIndex], fraction(-1)))
        );
        let artificial: Vector = new Array(this._num_constraints).fill(
          fraction(0)
        );
        artificial[i] = fraction(1);
        this.a_matrix = this.a_matrix.map((row, rowIndex) =>
          row.concat(artificial[rowIndex])
        );
        this.c_vec.push(
          new FractionNum(VarType.Slack, fraction(0), `s${i + 1}`)
        );
        this.c_vec.push(
          new FractionNum(VarType.Artificial, fraction(1), `a${i + 1}`)
        );
        this._basis.push(
          new FractionNum(VarType.Artificial, fraction(1), `a${i + 1}`)
        );
      }
    }
    console.log(this.a_matrix);
    console.log(this.c_vec);
    this.table = new SimplexTable(
      [...this.c_vec],
      this.a_matrix,
      this.b_vec,
      this._basis
    );
  }

  public solve(): [Table[] | null] {
    // Phase 1: Remove artificial variables
    this._phase_one();

    // Check if all artificial variables are out of the basis
    if (this._check_artificial_vars_out()) {
      // Phase 2: Solve the original problem
      this._phase_two();
      if (!this.chech_if_result_is_integer()) {
        this._phase_three();
      }
      return [this._tables];
    } else {
      console.log("No feasible solution.");
      return [null];
    }
  }

  private _phase_one() {
    // Modify objective function for artificial variables
    let artificial_obj: Vector = [];
    for (let i = 0; i < this.table?.c.length; i++) {
      const el: FractionNum = this.table?.c[i];
      if (this.table?.c[i]?.type != VarType.Artificial) {
        artificial_obj.push(new FractionNum(el.type, fraction(0), el.name));
      } else {
        artificial_obj.push(new FractionNum(el.type, el.value, el.name));
      }
    }

    this.table.c = artificial_obj;

    while (!this._check_artificial_vars_out()) {
      this._tables.push(this.table?.solve());
    }
  }

  private _check_artificial_vars_out(): boolean {
    if (this.table.basis.find((val) => val.type == VarType.Artificial)) {
      return false;
    }
    return true;
  }

  private _phase_two() {
    this.table.c = this.c_vec;

    for (let i = 0; i < this.table.c.length; i++) {
      if (this.table.c[i].type == VarType.Artificial) {
        this.table.c.splice(i, 1);
        this.table.A = this.table.A.map((row) => {
          row.splice(i, 1);
          return row;
        });
        this.table.delta.splice(i, 1);
      }

      for (const element of this.table.c) {
        for (let j = 0; j < this.table.basis.length; j++) {
          if (
            (this.table.basis[j].name as FractionNum) ==
            (element.name as FractionNum)
          ) {
            this.table.basis[j] = element;
          }
        }
      }
    }
    while (!this.is_optimal()) this._tables.push(this.table.solve(true));

    this.get_solution();
  }

  private _phase_three() {
    const constraint: Fraction[] = [];
    let index = 0;
    for (let i = 0; i < this.table.basis.length; i++) {
      if (
        this.table.basis[i].type == VarType.Regular &&
        !isInteger(number(this.table.b[i]))
      ) {
        index = i;
        break;
      }
    }

    constraint.push(
      ...this.table.A[index].map((val) => {
        let frac = fraction(subtract(val, floor(val)));
        frac.s = -1;
        return frac;
      })
    );
    const numOfSlack = this.table.basis.filter(
      (val) => val.type == VarType.Slack
    ).length;
    const newSlack = new FractionNum(
      VarType.Slack,
      fraction(1),
      `s${numOfSlack + 1}`
    );

    let basis = fraction(
      subtract(this.table.b[index], floor(this.table.b[index]))
    );
    basis.s = -1;
    this.table.b.push(basis);
    this.table.basis.push(newSlack);
    this.table.c.push(newSlack);
    this.table.delta.push(fraction(0));
    this.table.A.push(constraint);

    for (let i = 0; i < this.table.A.length; i++) {
      if (i != this.table.A.length - 1) {
        this.table.A[i].push(fraction(0));
      } else {
        this.table.A[i].push(fraction(1));
      }
    }
    this.table.reverse_simplex();
    console.log(this.table.A);
  }

  private chech_if_result_is_integer(): boolean {
    let result: boolean = true;
    for (const element of this.table.basis) {
      if (element.type == VarType.Regular) {
        if (isInteger(number(element.value))) {
          result = false;
          break;
        }
      }
    }
    return result;
  }

  private is_optimal(): boolean {
    const delta = this.table.get_delta();
    if (delta.every((val) => number(val) >= 0)) {
      return true;
    }
    return false;
  }

  public get_solution(): void {
    this.table.get_solution(this._num_vars);
  }
}

class SimplexTable {
  public c: Vector;
  public A: Matrix;
  public b: Vector;
  public delta: Vector = [];
  public basis: Vector = [];

  constructor(c: Vector, A: Matrix, b: Vector, basis: Vector) {
    this.c = c;
    this.A = A;
    this.b = b;
    this.basis = basis;
    this.delta = new Array(this.c.length).fill(0);
  }

  public solve(pivot_column_min: boolean = false): Table {
    let pivot_column = this.get_pivot_column(pivot_column_min);
    let pivot_row = this.get_pivot_row(pivot_column);
    return this.pivot(pivot_row, pivot_column) as Table;
  }

  private get_pivot_column(min: boolean): number {
    this.delta = this.get_delta();
    let max = 0;
    if (!min) {
      max = Math.max(...this.delta.map((val) => number(val)));
    } else {
      max = Math.min(...this.delta.map((val) => number(val)));
    }
    for (let i = 0; i < this.delta.length; i++) {
      if (this.delta[i] == max) {
        return i;
      }
    }
    return -1;
  }

  public reverse_simplex(): Table {
    return this;
  }

  private get_pivot_row(pivot_column: number): number {
    const ratios: Fraction[] = [];
    this.A.forEach((row, i) => {
      if (number(row[pivot_column]) > 0) {
        //ratios.push(this.b[i] / row[pivot_column]);
        ratios.push(fraction(divide(this.b[i], row[pivot_column])));
      } else {
        ratios.push(fraction(Number.MAX_SAFE_INTEGER));
      }
    });

    const min = Math.min(...ratios.map((val) => number(val)));
    for (let i = 0; i < ratios.length; i++) {
      if (number(ratios[i]) == min) {
        return i;
      }
    }
    return -1;
  }

  public get_delta(): Vector {
    const newDelta: any[] = [];
    for (let i = 0; i < this.delta.length; i++) {
      let sum = fraction(0);
      for (let j = 0; j < this.A.length; j++) {
        let basis = this.basis[j].value;
        let a = this.A[j][i];
        sum = add(sum, multiply(basis, a));
      }
      let c = this.c[i].value;
      newDelta.push(subtract(fraction(sum), c));
    }
    return newDelta;
  }

  private pivot(pivot_row: number, pivot_column: number): Table {
    const new_a: Matrix = [];
    const new_b: Fraction[] = [];
    for (let i = 0; i < this.A.length; i++) {
      if (i === pivot_row) {
        new_a.push(
          this.A[i].map((val) => divide(val, this.A[pivot_row][pivot_column]))
        );
        new_b.push(
          fraction(divide(this.b[pivot_row], this.A[pivot_row][pivot_column]))
        );
      } else {
        new_a.push(
          this.A[i].map((val, j) =>
            subtract(
              val,
              divide(
                multiply(this.A[i][pivot_column], this.A[pivot_row][j]),
                this.A[pivot_row][pivot_column]
              )
            )
          )
        );
        new_b.push(
          subtract(
            this.b[i],
            divide(
              multiply(this.A[i][pivot_column], this.b[pivot_row]),
              this.A[pivot_row][pivot_column]
            )
          )
        );
      }
    }
    console.log(divide(fraction(1), fraction(3)).toString());
    console.log(new_b.map((val) => fraction(val).toString()));
    this.basis[pivot_row] = this.c[pivot_column];
    this.b = new_b;
    this.A = new_a;
    return new Table(this.c, this.A, this.b, this.delta, this.basis);
  }

  public get_solution(num_vars: number): void {
    console.log(this.basis);
    console.log(this.b);
    console.log(this.A);
  }
}

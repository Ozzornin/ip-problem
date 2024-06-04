import { MarkOptions } from "perf_hooks";
import { MinMaxFunction, VarType } from "./enums";
import { FractionNum, VarNum } from "./varnum";
import { create, all, fraction, add } from "mathjs";

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
      let slack: Vector = new Array(this._num_constraints).fill(0);
      slack[i] = 1;

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
          row.concat(slack[rowIndex] * -1)
        );
        let artificial: Vector = new Array(this._num_constraints).fill(0);
        artificial[i] = 1;
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

  public solve(): [Vector | null, number | null] {
    // Phase 1: Remove artificial variables
    this._phase_one();

    // Check if all artificial variables are out of the basis
    if (this._check_artificial_vars_out()) {
      // Phase 2: Solve the original problem
      this._phase_two();
      return [this.get_solution(), this.get_func_value()];
    } else {
      console.log("No feasible solution.");
      return [null, null];
    }
  }

  private _phase_one() {
    // Modify objective function for artificial variables
    let artificial_obj: Vector = [this.table.c.length];
    for (let i = 0; i < this.table?.c.length; i++) {
      const el: FractionNum = this.table?.c[i];
      if (this.table?.c[i]?.type != VarType.Artificial) {
        artificial_obj.push(new FractionNum(el.type, el.value, el.name));
      } else {
        artificial_obj.push(new FractionNum(el.type, el.value, el.name));
      }
    }

    this.table.c = artificial_obj;

    while (!this._check_artificial_vars_out()) {
      this.table?.solve();
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
    }

    this.table.solve();
  }

  public get_solution(): Vector {
    return this.table.get_solution(this._num_vars);
  }

  public get_func_value(): number {
    return this.table.get_func_value();
  }
}

class SimplexTable {
  public c: Vector;
  public A: Matrix;
  private b: Vector;
  public delta: Vector = [];
  public basis: Vector = [];

  constructor(c: Vector, A: Matrix, b: Vector, basis: Vector) {
    this.c = c;
    this.A = A;
    this.b = b;
    this.basis = basis;
    this.delta = new Array(this.c.length).fill(0);
  }

  public solve() {
    let pivot_column = this.get_pivot_column();
    let pivot_row = this.get_pivot_row(pivot_column);
    this.pivot(pivot_row, pivot_column);
  }

  // private is_optimal(): boolean {
  //   if (this.basis.find((val) => val.type == VarType.Artificial)) {
  //     return false;
  //   }

  //   const delta = this.get_delta();
  //   if (delta.every((val) => val <= 0)) {
  //     return true;
  //   }
  //   return false;
  // }

  private get_pivot_column(): number {
    this.delta = this.get_delta();

    return this.delta.indexOf(Math.max(...this.delta));
  }

  private get_delta(): Vector {
    const newDelta: number[] = [];
    for (let i = 0; i < this.delta.length; i++) {
      let sum = 0;
      for (let j = 0; j < this.A.length; j++) {
        let basis = this.basis[j].value;
        let a = this.A[j][i];
        sum += basis * a;
      }
      newDelta.push(sum - this.c[i].value);
    }
    return newDelta;
  }

  private get_pivot_row(pivot_column: number): number {
    const ratios: number[] = [];
    this.A.forEach((row, i) => {
      if (row[pivot_column] > 0) {
        ratios.push(this.b[i] / row[pivot_column]);
      } else {
        ratios.push(Infinity);
      }
    });
    return ratios.indexOf(Math.min(...ratios));
  }

  private pivot(pivot_row: number, pivot_column: number) {
    const new_a: Matrix = [];
    const new_b: Vector = [];
    for (let i = 0; i < this.A.length; i++) {
      if (i === pivot_row) {
        new_a.push(
          this.A[i].map((val) => val / this.A[pivot_row][pivot_column])
        );
        new_b.push(this.b[pivot_row] / this.A[pivot_row][pivot_column]);
      } else {
        new_a.push(
          this.A[i].map(
            (val, j) =>
              val -
              (this.A[i][pivot_column] * this.A[pivot_row][j]) /
                this.A[pivot_row][pivot_column]
          )
        );
        new_b.push(
          this.b[i] -
            (this.A[i][pivot_column] * this.b[pivot_row]) /
              this.A[pivot_row][pivot_column]
        );
      }
    }
    this.basis[pivot_row] = this.c[pivot_column];
    this.b = new_b;
    this.A = new_a;
  }

  public get_solution(num_vars: number): Vector {
    // Extract the solution
    let solution: Vector = new Array(num_vars).fill(0);
    this.basic_vars.forEach((varIndex, i) => {
      if (varIndex < num_vars) {
        solution[varIndex] = this.b[i];
      }
    });
    return solution;
  }

  public get_func_value(): number {
    // Compute the objective function value
    return this.c.reduce(
      (sum, coef, i) => sum + coef * this.get_solution(this.c.length)[i],
      0
    );
  }
}

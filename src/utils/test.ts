import { VarType } from "./enums";
import { FractionNum } from "./varnum";
import {
  fraction,
  add,
  multiply,
  subtract,
  divide,
  number,
  isInteger,
  floor,
  abs,
  Fraction,
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
  public _tables: Table[] = [];

  constructor(
    func_vec: Vector,
    conditions_matrix: Matrix,
    constraints_vec: Vector,
    constraint_types: string[],
    log_mode: LogMode = LogMode.LOG_OFF
  ) {
    this.c_vec = func_vec.map(
      (val, index) =>
        new FractionNum(VarType.Regular, fraction(val), `x${index + 1}`)
    );
    this.a_matrix = conditions_matrix.map((row) =>
      row.map((val) => fraction(val))
    );
    this.b_vec = constraints_vec.map((val) => fraction(val));
    this.constraint_types = constraint_types;
    this.log_mode = log_mode;
    this._num_vars = this.c_vec.length;
    this._num_constraints = this.a_matrix.length;
    this.table = new SimplexTable(this.c_vec, this.a_matrix, this.b_vec, []);
    this._initializeSimplexTable();
  }

  private _initializeSimplexTable() {
    let numOfSlack = 0;
    let numOfArtificial = 0;

    for (let i = 0; i < this._num_constraints; i++) {
      let slack: Vector = new Array(this._num_constraints).fill(fraction(0));
      slack[i] = fraction(1);

      if (this.constraint_types[i] === "<=") {
        this._addSlackVariable(slack, numOfSlack++);
      } else if (this.constraint_types[i] === ">=") {
        this._addArtificialVariable(slack, numOfSlack++, numOfArtificial++);
      }
    }

    this.table = new SimplexTable(
      [...this.c_vec],
      this.a_matrix,
      this.b_vec,
      this._basis
    );
  }

  private _addSlackVariable(slack: Vector, numOfSlack: number) {
    this.a_matrix = this.a_matrix.map((row, rowIndex) =>
      row.concat(slack[rowIndex])
    );
    this.c_vec.push(
      new FractionNum(VarType.Slack, fraction(0), `s${numOfSlack}`)
    );
    this._basis.push(
      new FractionNum(VarType.Slack, fraction(0), `s${numOfSlack}`)
    );
  }

  private _addArtificialVariable(
    slack: Vector,
    numOfSlack: number,
    numOfArtificial: number
  ) {
    this._addSlackVariable(
      slack.map((val) => multiply(val, fraction(-1))),
      numOfSlack
    );
    let artificial: Vector = new Array(this._num_constraints).fill(fraction(0));
    artificial[numOfArtificial] = fraction(1);
    this.a_matrix = this.a_matrix.map((row, rowIndex) =>
      row.concat(artificial[rowIndex])
    );
    this.c_vec.push(
      new FractionNum(VarType.Artificial, fraction(1), `a${numOfArtificial}`)
    );
    this._basis.push(
      new FractionNum(VarType.Artificial, fraction(1), `a${numOfArtificial}`)
    );
  }

  public solve(): Table[] | null {
    if (!this._checkArtificialVarsOut()) {
      this._phaseOne();
    }
    this._phaseTwo();
    while (!this._isResultInteger()) {
      this._phaseThree();
    }
    return this._tables;
  }

  private _phaseOne() {
    this.table.c = this.table.c.map((el) =>
      el.type === VarType.Artificial
        ? new FractionNum(el.type, el.value, el.name)
        : new FractionNum(el.type, fraction(0), el.name)
    );

    while (!this._checkArtificialVarsOut()) {
      this.table.solve();
    }
  }

  private _checkArtificialVarsOut(): boolean {
    return !this.table.basis.some((val) => val.type === VarType.Artificial);
  }

  private _phaseTwo() {
    this.table.c = this.c_vec;

    this.table.c = this.table.c.filter((el) => el.type !== VarType.Artificial);
    this.table.A = this.table.A.map((row) =>
      row.filter((_, i) => this.table.c[i].type !== VarType.Artificial)
    );
    this.table.delta = this.table.delta.filter(
      (_, i) => this.table.c[i].type !== VarType.Artificial
    );
    this.table.basis = this.table.basis.map(
      (basisEl) =>
        this.table.c.find((el) => el.name === basisEl.name) || basisEl
    );

    while (!this._isOptimal()) {
      this.table.solve(true);
    }

    this._getSolution();
  }

  private _phaseThree() {
    let constraint: Fraction[] = [];
    let index = this.table.basis.findIndex(
      (basisEl, i) =>
        basisEl.type === VarType.Regular && !isInteger(number(this.table.b[i]))
    );

    constraint = this.table.A[index].map((val) => {
      let frac = fraction(subtract(val, floor(val)));
      frac.s *= -1;
      return frac;
    });

    let numOfSlack = this.table.c.filter(
      (val) => val.type === VarType.Slack
    ).length;
    let newSlack = new FractionNum(
      VarType.Slack,
      fraction(0),
      `s${numOfSlack + 1}`
    );

    let basis = fraction(
      subtract(this.table.b[index], floor(this.table.b[index]))
    );
    basis.s *= -1;
    this.table.b.push(basis);
    this.table.basis.push(newSlack);
    this.table.c.push(newSlack);
    this.table.delta.push(fraction(0));
    this.table.A.push(constraint);

    this.table.A.forEach((row, i) =>
      row.push(i !== this.table.A.length - 1 ? fraction(0) : fraction(1))
    );
    this.table.reverseSimplex();
  }

  private _isResultInteger(): boolean {
    return this.table.basis.every(
      (basisEl, i) =>
        basisEl.type !== VarType.Regular || isInteger(number(this.table.b[i]))
    );
  }

  private _isOptimal(): boolean {
    return this.table.getDelta().every((val) => number(val) >= 0);
  }

  private _getSolution() {
    this.table.getSolution(this._num_vars);
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

  public solve(pivotColumnMin: boolean = false): Table {
    let pivotColumn = this._getPivotColumn(pivotColumnMin);
    let pivotRow = this._getPivotRow(pivotColumn);
    return this._pivot(pivotRow, pivotColumn) as Table;
  }

  private _getPivotColumn(min: boolean): number {
    this.delta = this.getDelta();
    let extremeValue = min
      ? Math.min(...this.delta.map((val) => number(val)))
      : Math.max(...this.delta.map((val) => number(val)));
    return this.delta.findIndex((val) => number(val) === extremeValue);
  }

  public reverseSimplex(): Table {
    let pivotRow = this._getPivotRowR();
    let pivotColumn = this._getPivotColumnR(pivotRow);
    return this._pivot(pivotRow, pivotColumn);
  }

  private _getPivotColumnR(row: number): number {
    let delta = this.getDelta();
    let ratios = this.A[row].map((val, i) =>
      val && val !== 1 ? fraction(abs(divide(delta[i], val))) : fraction(0)
    );
    let minRatio = Math.min(...ratios.map((val) => number(val)));
    return ratios.findIndex((val) => number(val) === minRatio);
  }

  private _getPivotRowR(): number {
    let minB = Math.min(...this.b.map((val) => number(val)));
    return this.b.findIndex((val) => number(val) === minB);
  }

  private _getPivotRow(pivotColumn: number): number {
    let ratios = this.A.map((row, i) =>
      number(row[pivotColumn]) > 0
        ? fraction(divide(this.b[i], row[pivotColumn]))
        : fraction(Number.MAX_SAFE_INTEGER)
    );
    let minRatio = Math.min(...ratios.map((val) => number(val)));
    return ratios.findIndex((val) => number(val) === minRatio);
  }

  public getDelta(): Vector {
    return this.c.map((el, i) => {
      let sum = this.basis.reduce(
        (acc, basisEl, j) => add(acc, multiply(basisEl.value, this.A[j][i])),
        fraction(0)
      );
      return subtract(sum, el.value);
    });
  }

  private _pivot(pivotRow: number, pivotColumn: number): Table {
    let newA = this.A.map((row, i) =>
      row.map((val, j) =>
        i === pivotRow
          ? divide(val, this.A[pivotRow][pivotColumn])
          : subtract(
              val,
              divide(
                multiply(this.A[i][pivotColumn], this.A[pivotRow][j]),
                this.A[pivotRow][pivotColumn]
              )
            )
      )
    );
    let newB = this.b.map((val, i) =>
      i === pivotRow
        ? divide(val, this.A[pivotRow][pivotColumn])
        : subtract(
            val,
            divide(
              multiply(this.A[i][pivotColumn], this.b[pivotRow]),
              this.A[pivotRow][pivotColumn]
            )
          )
    );

    this.basis[pivotRow] = this.c[pivotColumn];
    this.b = newB;
    this.A = newA;

    return new Table(this.c, this.A, this.b, this.delta, this.basis);
  }

  public getSolution(numVars: number): void {
    console.log(this.basis, this.b, this.A);
  }
}

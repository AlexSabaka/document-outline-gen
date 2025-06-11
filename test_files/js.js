import "./utils.js";

export class Atom {
  constructor(s) {
    this.isKeyword = Object.keys(keywords).indexOf(s) > 0;
    this.id = s;
  }
  toString() {
    return this.isKeyword ? this.id.toUpperCase() : `${this.id}`;
  }
}

export class Value {
  constructor(s) {
    this.val = s;
  }
  toString () {
    if (typeof this.val === 'string') {
      return `"${this.val}"`;
    }
    return `${this.val}`;
  }
}

export class List {
  constructor(list) {
    this.list = list;
  }
  toString () {
    return `(${this.list.map(x => x.toString()).join(' ')})`;
  }
}

export class Quote {
  constructor(list) {
    this.list = list;
  }
  toString () {
    return `\`(${this.list.map(x => x.toString()).join(' ')})`;
  }
}

export class Lambda {
  constructor(body, params, env) {
    this.body = body;
    this.env = env || {};
    this.params =
      params instanceof List ? params.list :
      params instanceof Quote ? params.list :
      params instanceof Array ? params : [params];
  }
  run(args, env) {
    args = args instanceof Array ? args : [args];
    if (typeof this.body === "function") {
      return this.body.apply(this, args);
    }

    const arrParam = this.params.find(x => (x.id || x).startsWith('...'));
    const arrParamIdx = this.params.indexOf(arrParam);
    if (arrParamIdx >= 0 && arrParamIdx != this.params.length - 1) {
      throw new Error("params argument must be a last parameter");
    }

    const localEnv = this.params.reduce(
      (acc, curr, i) => i === arrParamIdx ? acc : Object.assign(acc, {[curr.id || curr]: args[i] ?? curr}),
      {...this.env, ...env}
    );

    if (arrParamIdx >= 0) {
      const paramName = (arrParam.id || arrParam).slice('...'.length);
      localEnv[paramName] = args.slice(this.params.length - 1);
    }

    return eval_sform(this.body, localEnv);
  }
  toString () {
    return this.body instanceof List ? `(λ (${this.params.join(' ')}) ${this.body})` : this.body.toString();
  }
}

export class ClassDef {
  constructor(className, prototype, env) {
    const members = prototype.groupBy((_, i) => Math.round(i / 2 - 0.5));
    this.className = className;
    this.prototype = Object.keys(members).reduce((acc, k) => {
      const [memberName, value] = members[k];
      acc[memberName.id ?? memberName] = eval_sform(value, env);
      return acc;
    }, {});
  }
  ctor(args, env) {
    return { ...this.prototype };
  }
  toString () {
    return `(CLASS ${this.className} ${Object.keys(this.prototype).map(x => `${x} ${this.prototype[x]}`).join(' ')})`;
  }
}

export class ClassInstance {
  constructor(classDef, ctorArgs, env) {
    this.definition = classDef;
    this.instance = classDef.ctor(ctorArgs, env);
  }

  run(member, args, env) {
    const m = this.instance[member.id ?? member];
    if (m === undefined) {
      throw new Error(`Member '${member.id ?? member}' not present in the class definition '${this.definition}'`);
    }
    return m instanceof Lambda ? m.run(args, { ...env, ...this.instance }) : m;
  }

  toString() {
    return `(OBJECT ${Object.keys(this.instance).map(x => `${x} ${this.instance[x]}`).join(' ')})`;
  }
}

const eval_quote = ([_, ...rest], env) => new Quote(rest);
const eval_cons = ([_, ...rest], env) => new List(rest);
const eval_unquote = ([_, ...rest], env) => rest.map(x => eval_sform(new List(eval_sform(x, env).list), env));
const eval_set = ([_, { id }, val], env) => env[id] = eval_sform(val, env);
const eval_define = eval_set;
const eval_lambda = ([_, args, body], env) => new Lambda(body, args, env);
const eval_if = ([_, condition, trueBranch, falseBranch], env) => eval_sform( eval_sform(condition, env) ? trueBranch : falseBranch , env );
const eval_cond = ([_, ...rest], env) => {
  const conditions = rest.groupBy((_, i) => Math.round(i / 2 - 0.5));
  const trueIndex = Object.keys(conditions).findIndex(k => {
    const [cond, _] = conditions[k];
    return eval_sform(cond, env) === true;
  });
  if (trueIndex > 0) {
    const expr = conditions[trueIndex][1];
    return eval_sform( expr , env );
  } else {
    return undefined;
  }
};
const eval_progn = ([_, ...rest], env) => rest.map((x) => eval_sform(x, env)).pop();
const eval_class = ([_, className, ...rest], env) => new ClassDef(className, rest, env);
const eval_new = ([_, classProto, ...rest], env) => new ClassInstance(env[classProto.id ?? classProto], rest, env);
const eval_cdr = ([_, ...rest], env) => rest[0]?.list[1] ?? rest[1];
const eval_car = ([_, ...rest], env) => rest[0]?.list[0] ?? rest[0];

export const eval_sform = (s, env = {}) => {
  if (s instanceof Atom) {
    return env[s.id] !== undefined ? env[s.id] : s;
  } else if (s instanceof Value) {
    return s.val;
  } else if (s instanceof Quote) {
    return s;
  } else if (s instanceof List) {
    if (!s.list || s.list.length == 0) {
      return null;
    }

    const l = eval_sform(s.list[0], env);
    const lambda = l[0] ?? l;
    if (lambda instanceof Lambda) {
      const args = s.list.slice(1).map((x) => eval_sform(x, env));
      return lambda.run(args, env);
    } else if (lambda instanceof ClassDef) {
      return eval_new([undefined, lambda, ...s.list.slice(1)], env);
    } else if (lambda instanceof ClassInstance) {
      const args = s.list.slice(1).map((x) => eval_sform(x, env));
      return lambda.run(args, env);
    } else if (lambda instanceof Atom) {
      if (lambda.isKeyword) {
        return keywords[lambda.id]([lambda, ...s.list.slice(1)], env);
      } else {
        return env[lambda.id] || lambda;
      }
    } else if (lambda instanceof List) {
      return eval_sform(lambda, env);
    } else if (lambda instanceof Value) {
      return lambda.val;
    } else {
      return new List([lambda, ...s.list.slice(1)]);
    }
  } else {
    return s?.list || env[s] || s;
  }
};

export const eval_sform_new = (s, env = {}) => {
  switch (s.type) {
    case "number":
    case "string":
      return s.value;
    case "identifier":
      return env[s.id];
    case "list":
      return eval_sform_new(s.nodes, env);
  }
}

export const keywords = {
  "quote": eval_quote,
  "unquote": eval_unquote,
  "set!": eval_set,
  "defun": eval_define,
  "lambda": eval_lambda,
  "class": eval_class,
  "new": eval_new,
  "progn": eval_progn,
  "if": eval_if,
  "cond": eval_cond,
  "car": eval_car,
  "cdr": eval_cdr,
  "cons": eval_cons,
};
import { ProtocolError } from "@robots/system-api";
export function copyIntegerData<T>(value:T,errorCode='DATA_INVALID'):T{
 function fail(message:string):never{throw new ProtocolError(errorCode,message);}
 const active=new Set<object>();function walk(v:unknown,depth:number):unknown{
  if(depth>32)fail("Data depth exceeded");if(v===null||typeof v==="string"||typeof v==="boolean")return v;if(typeof v==="number"&&Number.isSafeInteger(v))return v===0?0:v;
  if(typeof v!=="object"||!v||active.has(v))fail("Expected acyclic plain data");
  const array=Array.isArray(v),proto=Object.getPrototypeOf(v);if(proto!==(array?Array.prototype:Object.prototype)&&!(proto===null&&!array))fail("Unexpected prototype");
  const descriptors=Object.getOwnPropertyDescriptors(v),keys=Reflect.ownKeys(v);active.add(v);
  if(keys.some(k=>typeof k!=="string"))fail("Symbol data forbidden");
  let result:unknown;if(array){const n=(v as unknown[]).length;if(keys.length!==n+1)fail("Sparse/decorated array");const out:unknown[]=[];for(let i=0;i<n;i++){const d=descriptors[String(i)];if(!d||!d.enumerable||!("value"in d))fail("Array accessor");out.push(walk(d.value,depth+1));}result=Object.freeze(out);}
  else{const out:Record<string,unknown>={};for(const k of (keys as string[]).sort()){const d=descriptors[k]!;if(!d.enumerable||!("value"in d))fail("Accessor/hidden field");Object.defineProperty(out,k,{value:walk(d.value,depth+1),enumerable:true});}result=Object.freeze(out);}
  active.delete(v);return result;
 }const out=walk(value,0);if(new TextEncoder().encode(JSON.stringify(out)).length>65536)fail("Data byte budget exceeded");return out as T;
}

export function freezeIntegerData<T>(value: T, errorCode = 'DATA_INVALID'): T {
    function fail(message: string): never { throw new ProtocolError(errorCode, message); }
    const seen = new Set<object>();
    function walk(v: unknown, depth = 0): unknown {
        if (depth > 32)
            fail('Data too deep');
        if (v === null || typeof v === 'string' || typeof v === 'boolean')
            return v;
        if (typeof v === 'number' && Number.isSafeInteger(v))
            return v;
        if (!v || typeof v !== 'object' || seen.has(v))
            fail('Expected acyclic data');
        const array = Array.isArray(v);
        if (Object.getPrototypeOf(v) !== (array ? Array.prototype : Object.prototype))
            fail('Unexpected prototype');
        seen.add(v);
        const descriptors = Object.getOwnPropertyDescriptors(v), out: any = array ? [] : {};
        for (const k of Reflect.ownKeys(v)) {
            if (k === 'length' && array)
                continue;
            if (typeof k !== 'string')
                fail('Symbol key');
            const d = descriptors[k]!;
            if (!d.enumerable || !('value' in d))
                fail('Hidden field/accessor');
            Object.defineProperty(out, k, { value: walk(d.value, depth + 1), enumerable: true });
        }
        if (array && Object.keys(out).length !== (v as unknown[]).length)
            fail('Sparse array');
        seen.delete(v);
        return Object.freeze(out);
    }
    return walk(value) as T;
}

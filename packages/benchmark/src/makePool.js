async function makePool(count, construct) {
  if (count === 0) {
    return () => null;
  }
  const arr = [];
  for (let i = 0; i < count; i++) {
    arr.push(await construct(i));
  }

  if (count === 1) {
    const obj = arr[0];
    const fn = () => obj;
    fn.array = arr;
    return fn;
  }
  let firstObject = { value: arr[0] };
  let currentObject = firstObject;
  for (let i = 1; i < count; i++) {
    currentObject.next = { value: arr[i] };
    currentObject = currentObject.next;
  }
  currentObject.next = firstObject;
  const fn = () => {
    currentObject = currentObject.next;
    return currentObject.value;
  };
  fn.array = arr;
  return fn;
}

exports.makePool = makePool;

import { selectWeighted } from '../behaviours';

test('Select weighted behaviour', () => {
    let result = selectWeighted([{ weight: 0 }, { weight: 20 }])!;
    expect(result.weight).toBe(20);

    result = selectWeighted([{ weight: 10 }, { weight: 0 }])!;
    expect(result.weight).toBe(10);
});

test('Single weighted option', () => {
    let result = selectWeighted([{ weight: 0 }])!;
    expect(result.weight).toBe(0);

    result = selectWeighted([{ weight: 10 }])!;
    expect(result.weight).toBe(10);
});

test('No weighted options', () => {
    let result = selectWeighted([])!;
    expect(result).toBe(undefined);
});
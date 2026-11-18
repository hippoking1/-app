import { describe, it, expect } from 'vitest';
import { filterMerchants } from '../src/utils/merchantPatterns';

describe('filterMerchants', () => {
  const sampleMerchants = [
    { name: '7-ELEVEN', count: 15 },
    { name: '台北捷運', count: 12 },
    { name: '全聯', count: 10 },
    { name: '台鐵', count: 8 },
    { name: '台灣大哥大', count: 3 },
    { name: '新光三越台北站前店', count: 2 },
    { name: '天一藥局', count: 1 },
    { name: '迪卡儂', count: 1 },
    { name: '蝦皮', count: 1 },
    { name: '義美食品', count: 1 }
  ];

  it('空字串或純空白時應回傳空陣列（不預設帶出所有店家）', () => {
    expect(filterMerchants('', sampleMerchants)).toEqual([]);
    expect(filterMerchants('   ', sampleMerchants)).toEqual([]);
  });

  it('應依輸入文字進行不分大小寫篩選並優先排序字首符合項目', () => {
    const res = filterMerchants('台北', sampleMerchants);
    expect(res.map((m) => m.name)).toEqual(['台北捷運', '新光三越台北站前店']);

    const enRes = filterMerchants('eleven', sampleMerchants);
    expect(enRes.map((m) => m.name)).toEqual(['7-ELEVEN']);
  });

  it('同為字首符合時應依歷史消費次數降序排列，且排於中段符合之前', () => {
    const res = filterMerchants('台', sampleMerchants);
    expect(res.map((m) => m.name)).toEqual(['台北捷運', '台鐵', '台灣大哥大', '新光三越台北站前店']);
  });

  it('已完全輸入精確相符的店家名稱時應略過該項目本身，但保留更長衍生店家', () => {
    expect(filterMerchants('台鐵', sampleMerchants)).toEqual([]);

    const expanded = [
      ...sampleMerchants,
      { name: '台鐵便當', count: 4 }
    ];
    expect(filterMerchants('台鐵', expanded).map((m) => m.name)).toEqual(['台鐵便當']);
  });

  it('應依 limit 參數限制最多回傳筆數', () => {
    const many = Array.from({ length: 12 }, (_, idx) => ({
      name: `全聯門市 ${idx + 1}`,
      count: 12 - idx
    }));
    const res = filterMerchants('全聯', many, 8);
    expect(res).toHaveLength(8);
    expect(res[0].name).toBe('全聯門市 1');
  });
});

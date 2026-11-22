import assert from 'node:assert/strict';
import test from 'node:test';
import { capTreemapBlocks, TREEMAP_DEMAIS } from '../../../front/src/lib/treemapData.ts';

test('capTreemapBlocks agrupa categorias pequenas em Demais', () => {
    const blocks = [
        { name: 'Casa', total: 3000, subcategories: [] },
        { name: 'Lazer', total: 1700, subcategories: [] },
        { name: 'Alimentação', total: 700, subcategories: [] },
        { name: 'Viagens', total: 500, subcategories: [] },
        { name: 'Autocuidado', total: 490, subcategories: [] },
        { name: 'Tecnologia', total: 320, subcategories: [] },
        { name: 'Educação', total: 260, subcategories: [] },
        { name: 'Telefone', total: 100, subcategories: [] },
        { name: 'Assinaturas', total: 78, subcategories: [] }
    ];
    const { blocks: out, mergedCount } = capTreemapBlocks(blocks);
    assert.ok(out.length <= 7);
    assert.ok(mergedCount >= 2);
    assert.equal(out[out.length - 1].name, TREEMAP_DEMAIS);
    const names = out.map((b) => b.name);
    assert.equal(names.includes('Telefone'), false);
    assert.equal(names.includes('Assinaturas'), false);
});
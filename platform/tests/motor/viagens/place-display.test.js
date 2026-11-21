import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    coerceLatinGeocodeLabel,
    countryDisplayName,
    expandGeocodeQuery,
    formatNominatimPlace,
    curateGeocodeHits,
    geocodeAliasFallback,
    geocodeHitDisplayLabel,
    nearestGeocodeAliasHits,
    parentCityFromLatinAddress,
    isGenericCountryGeocodeHit,
    pickAddressDisplayLine,
    pickNominatimPrimaryName,
    pickPlaceDisplayName,
    resolveMapPinSuggestions,
    snapGreatWallPlace
} from '../../../../motor/viagens/place-display.js';

test('pickPlaceDisplayName uses local name outside China', () => {
    assert.equal(
        pickPlaceDisplayName({ name: '東京', nameEn: 'Tokyo', countryCode: 'JP' }),
        '東京'
    );
});

test('pickPlaceDisplayName romanizes China', () => {
    assert.equal(
        pickPlaceDisplayName({ name: '北京饭店', nameEn: 'Beijing Hotel', countryCode: 'CN' }),
        'Beijing Hotel'
    );
});

test('formatNominatimPlace China', () => {
    const f = formatNominatimPlace({
        name: '外滩',
        display_name: '外滩, 黄浦区, 上海市, 中国',
        address: { country_code: 'cn', country: 'China', city: 'Shanghai' },
        namedetails: { 'name:en': 'The Bund' }
    });
    assert.equal(f.name, 'The Bund');
});

test('pickNominatimPrimaryName prefers pt for China', () => {
    assert.equal(
        pickNominatimPrimaryName({
            name: '上海市',
            display_name: '上海市, 中国',
            address: { country_code: 'cn', country: '中国' },
            namedetails: { name: '上海市', 'name:pt': 'Xangai', 'name:en': 'Shanghai' }
        }),
        'Xangai'
    );
});

test('formatNominatimPlace country in pt-BR', () => {
    const f = formatNominatimPlace({
        name: '上海市',
        display_name: '上海市, 中国',
        address: { country_code: 'cn', country: '中国' },
        namedetails: { 'name:pt': 'Xangai', 'name:en': 'Shanghai' }
    });
    assert.equal(f.country, 'China');
    assert.equal(f.name, 'Xangai');
});

test('countryDisplayName maps hanzi', () => {
    assert.equal(countryDisplayName('中国', 'cn'), 'China');
});

test('expandGeocodeQuery maps xangai', () => {
    assert.equal(expandGeocodeQuery('xangai'), 'Xangai, China');
});

test('parentCityFromLatinAddress maps Furong to Changsha', () => {
    assert.equal(
        parentCityFromLatinAddress('Furong District, Changsha, Hunan, China', 'Furong'),
        'Changsha'
    );
});

test('formatNominatimPlace Furong district city Changsha', () => {
    const item = {
        name: '芙蓉区',
        display_name: '芙蓉区, 长沙市, 湖南省, 中国',
        address: {
            country_code: 'cn',
            country: 'China',
            city: '芙蓉区',
            region: '长沙市',
            state: '湖南省'
        },
        namedetails: { 'name:en': 'Furong District', 'name:pt': 'Furong' }
    };
    const fmt = formatNominatimPlace(item, 'furong');
    assert.match(fmt.city ?? '', /changsha/i);
});

test('expandGeocodeQuery maps muralha da china to Badaling', () => {
    assert.match(expandGeocodeQuery('muralha da china'), /badaling.*beijing/i);
});

test('geocodeAliasFallback returns Muralha da China as attraction', () => {
    const hit = geocodeAliasFallback('muralha da china');
    assert.ok(hit);
    assert.match(hit.name, /muralha/i);
    assert.match(hit.city ?? '', /pequim|beijing/i);
    assert.equal(hit.kind, 'attraction');
    assert.equal(hit.countryCode, 'cn');
});

test('snapGreatWallPlace corrige geocode longe de Badaling', () => {
    const snapped = snapGreatWallPlace({
        name: 'Muralha Da China',
        country: 'China',
        city: 'Beijing',
        kind: 'city',
        latitude: 39.5951868,
        longitude: 111.795312
    });
    assert.equal(snapped.kind, 'attraction');
    assert.ok(Math.abs(snapped.longitude - 116.5704) < 0.02);
    assert.ok(Math.abs(snapped.latitude - 40.4319) < 0.02);
});

test('snapGreatWallPlace mantém ponto perto de Badaling', () => {
    const snapped = snapGreatWallPlace({
        name: 'Muralha da China',
        country: 'China',
        kind: 'city',
        latitude: 40.35,
        longitude: 116.01
    });
    assert.equal(snapped.latitude, 40.35);
    assert.equal(snapped.longitude, 116.01);
    assert.equal(snapped.kind, 'attraction');
});

test('curateGeocodeHits returns a single Great Wall attraction', () => {
    const curated = curateGeocodeHits('muralha da china', [
        {
            name: 'Badaling Great Wall',
            country: 'China',
            countryCode: 'cn',
            city: 'Beijing',
            latitude: 40.35,
            longitude: 116.01,
            kind: 'city',
            importance: 0.7
        },
        {
            name: 'Muralha Da China',
            country: 'China',
            countryCode: 'cn',
            latitude: 40.43,
            longitude: 116.57,
            kind: 'city',
            importance: 0.5
        }
    ]);
    assert.equal(curated.length, 1);
    assert.equal(curated[0].kind, 'attraction');
    assert.match(curated[0].name, /muralha/i);
});

test('geocodeAliasFallback returns Xangai', () => {
    const hit = geocodeAliasFallback('xangai');
    assert.ok(hit);
    assert.equal(hit.name, 'Xangai');
    assert.equal(hit.countryCode, 'cn');
    assert.ok(Number.isFinite(hit.latitude));
});

test('nearestGeocodeAliasHits picks Xangai near Shanghai coords', () => {
    const hits = nearestGeocodeAliasHits(31.23, 121.47, { limit: 3 });
    assert.ok(hits.length >= 1);
    assert.match(String(hits[0].name), /xangai|shanghai/i);
});

test('resolveMapPinSuggestions always returns a named place', () => {
    const hits = resolveMapPinSuggestions(31.2, 121.5, [], { limit: 3 });
    assert.ok(hits.length >= 1);
    assert.match(String(hits[0].name), /xangai|shanghai/i);
    assert.notEqual(String(hits[0].kind), 'country');
});

test('curateGeocodeHits puts Xangai city first and dedupes near hits', () => {
    const curated = curateGeocodeHits('xangai', [
        {
            name: 'Shanghai Tower',
            country: 'China',
            countryCode: 'cn',
            latitude: 31.2335,
            longitude: 121.5055,
            kind: 'attraction',
            importance: 0.5
        },
        {
            name: 'Shanghai',
            country: 'China',
            countryCode: 'cn',
            latitude: 31.2304,
            longitude: 121.4737,
            kind: 'city',
            importance: 0.9
        },
        {
            name: 'Shanghai',
            country: 'China',
            countryCode: 'cn',
            latitude: 31.231,
            longitude: 121.474,
            kind: 'poi',
            importance: 0.4
        }
    ]);
    assert.ok(curated.length >= 1);
    assert.ok(curated.length <= 5);
    assert.match(String(curated[0].name), /xangai|shanghai/i);
    assert.equal(curated[0].kind, 'city');
    const nearShanghai = curated.filter(
        (h) => Math.abs(h.latitude - 31.23) < 0.05 && Math.abs(h.longitude - 121.47) < 0.05
    );
    assert.equal(nearShanghai.length, 1);
});

test('geocodeHitDisplayLabel avoids hanzi titles', () => {
    const hit = {
        name: '芙蓉区',
        country: 'China',
        countryCode: 'cn',
        address: '芙蓉区, 长沙市, 湖南省, 中国',
        city: '长沙市'
    };
    const d = geocodeHitDisplayLabel(hit, 'furong');
    assert.ok(/furong/i.test(d.title));
    assert.ok(!/[\u4e00-\u9fff]/.test(d.title));
});

test('formatNominatimPlace FURONG without namedetails uses en place name', () => {
    const item = {
        name: '芙蓉区',
        display_name: '芙蓉区, Changsha, Hunan, China',
        address: { country_code: 'cn', country: 'China', city: 'Changsha', state: 'Hunan' },
        class: 'boundary',
        type: 'administrative',
        place_rank: 12
    };
    const fmt = formatNominatimPlace(item, 'FURONG');
    assert.notEqual(fmt.name.toLowerCase(), 'china');
    assert.ok(/furong|changsha/i.test(fmt.name));
});

test('isGenericCountryGeocodeHit rejects China when searching xangai', () => {
    assert.equal(
        isGenericCountryGeocodeHit({ name: 'China', country: 'China', countryCode: 'cn', kind: 'city' }, 'xangai'),
        true
    );
});

test('coerceLatinGeocodeLabel uses city when name is country', () => {
    assert.equal(
        coerceLatinGeocodeLabel(
            { name: 'China', country: 'China', countryCode: 'cn', city: 'Xangai' },
            'xangai'
        ),
        'Xangai'
    );
});

test('coerceLatinGeocodeLabel avoids hanzi title', () => {
    assert.equal(
        coerceLatinGeocodeLabel({
            name: '上海市',
            country: 'China',
            countryCode: 'cn',
            address: 'Xangai, China'
        }),
        'Xangai'
    );
});
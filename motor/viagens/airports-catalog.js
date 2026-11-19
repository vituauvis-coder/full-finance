/** Catálogo compacto IATA → cidade (busca local, sem chave). */

export const AIRPORTS_CATALOG = [
    { iata: 'REC', name: 'Guararapes', city: 'Recife', country: 'Brasil' },
    { iata: 'GRU', name: 'Guarulhos', city: 'São Paulo', country: 'Brasil' },
    { iata: 'CGH', name: 'Congonhas', city: 'São Paulo', country: 'Brasil' },
    { iata: 'VCP', name: 'Viracopos', city: 'Campinas', country: 'Brasil' },
    { iata: 'GIG', name: 'Galeão', city: 'Rio de Janeiro', country: 'Brasil' },
    { iata: 'SDU', name: 'Santos Dumont', city: 'Rio de Janeiro', country: 'Brasil' },
    { iata: 'BSB', name: 'Brasília', city: 'Brasília', country: 'Brasil' },
    { iata: 'CNF', name: 'Confins', city: 'Belo Horizonte', country: 'Brasil' },
    { iata: 'SSA', name: 'Salvador', city: 'Salvador', country: 'Brasil' },
    { iata: 'FOR', name: 'Fortaleza', city: 'Fortaleza', country: 'Brasil' },
    { iata: 'MCZ', name: 'Zumbi', city: 'Maceió', country: 'Brasil' },
    { iata: 'NAT', name: 'São Gonçalo', city: 'Natal', country: 'Brasil' },
    { iata: 'CWB', name: 'Afonso Pena', city: 'Curitiba', country: 'Brasil' },
    { iata: 'POA', name: 'Salgado Filho', city: 'Porto Alegre', country: 'Brasil' },
    { iata: 'FLN', name: 'Hercílio Luz', city: 'Florianópolis', country: 'Brasil' },
    { iata: 'BEL', name: 'Val-de-Cans', city: 'Belém', country: 'Brasil' },
    { iata: 'MAO', name: 'Eduardo Gomes', city: 'Manaus', country: 'Brasil' },
    { iata: 'MAD', name: 'Barajas', city: 'Madri', country: 'Espanha' },
    { iata: 'BCN', name: 'El Prat', city: 'Barcelona', country: 'Espanha' },
    { iata: 'LIS', name: 'Humberto Delgado', city: 'Lisboa', country: 'Portugal' },
    { iata: 'OPO', name: 'Sá Carneiro', city: 'Porto', country: 'Portugal' },
    { iata: 'CDG', name: 'Charles de Gaulle', city: 'Paris', country: 'França' },
    { iata: 'ORY', name: 'Orly', city: 'Paris', country: 'França' },
    { iata: 'AMS', name: 'Schiphol', city: 'Amsterdã', country: 'Países Baixos' },
    { iata: 'FCO', name: 'Fiumicino', city: 'Roma', country: 'Itália' },
    { iata: 'MXP', name: 'Malpensa', city: 'Milão', country: 'Itália' },
    { iata: 'LHR', name: 'Heathrow', city: 'Londres', country: 'Reino Unido' },
    { iata: 'LGW', name: 'Gatwick', city: 'Londres', country: 'Reino Unido' },
    { iata: 'FRA', name: 'Frankfurt', city: 'Frankfurt', country: 'Alemanha' },
    { iata: 'MUC', name: 'Munique', city: 'Munique', country: 'Alemanha' },
    { iata: 'ZRH', name: 'Zurique', city: 'Zurique', country: 'Suíça' },
    { iata: 'IST', name: 'Istambul', city: 'Istambul', country: 'Turquia' },
    { iata: 'DXB', name: 'Dubai', city: 'Dubai', country: 'Emirados Árabes' },
    { iata: 'DOH', name: 'Hamad', city: 'Doha', country: 'Catar' },
    { iata: 'JFK', name: 'JFK', city: 'Nova York', country: 'EUA' },
    { iata: 'EWR', name: 'Newark', city: 'Nova York', country: 'EUA' },
    { iata: 'MIA', name: 'Miami', city: 'Miami', country: 'EUA' },
    { iata: 'LAX', name: 'Los Angeles', city: 'Los Angeles', country: 'EUA' },
    { iata: 'ORD', name: "O'Hare", city: 'Chicago', country: 'EUA' },
    { iata: 'PEK', name: 'Capital', city: 'Pequim', country: 'China' },
    { iata: 'PKX', name: 'Daxing', city: 'Pequim', country: 'China' },
    { iata: 'PVG', name: 'Pudong', city: 'Xangai', country: 'China' },
    { iata: 'SHA', name: 'Hongqiao', city: 'Xangai', country: 'China' },
    { iata: 'CAN', name: 'Baiyun', city: 'Cantão', country: 'China' },
    { iata: 'HKG', name: 'Hong Kong', city: 'Hong Kong', country: 'Hong Kong' },
    { iata: 'NRT', name: 'Narita', city: 'Tóquio', country: 'Japão' },
    { iata: 'HND', name: 'Haneda', city: 'Tóquio', country: 'Japão' },
    { iata: 'ICN', name: 'Incheon', city: 'Seul', country: 'Coreia do Sul' },
    { iata: 'SIN', name: 'Changi', city: 'Singapura', country: 'Singapura' },
    { iata: 'BKK', name: 'Suvarnabhumi', city: 'Bangkok', country: 'Tailândia' },
    { iata: 'EZE', name: 'Ezeiza', city: 'Buenos Aires', country: 'Argentina' },
    { iata: 'SCL', name: 'Arturo Merino', city: 'Santiago', country: 'Chile' },
    { iata: 'LIM', name: 'Jorge Chávez', city: 'Lima', country: 'Peru' },
    { iata: 'BOG', name: 'El Dorado', city: 'Bogotá', country: 'Colômbia' },
    { iata: 'MEX', name: 'Benito Juárez', city: 'Cidade do México', country: 'México' }
];

export function searchAirportsCatalog(query, limit = 8) {
    const q = String(query ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '');
    if (q.length < 1) return [];
    const scored = AIRPORTS_CATALOG.map((a) => {
        const hay = `${a.iata} ${a.city} ${a.name} ${a.country}`
            .toLowerCase()
            .normalize('NFD')
            .replace(/\p{M}/gu, '');
        let score = 0;
        if (a.iata.toLowerCase() === q) score = 100;
        else if (a.iata.toLowerCase().startsWith(q)) score = 80;
        else if (hay.startsWith(q)) score = 60;
        else if (hay.includes(q)) score = 40;
        return { ...a, score };
    })
        .filter((a) => a.score > 0)
        .sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(({ score: _s, ...rest }) => rest);
}

export function airportLabel(hit) {
    if (!hit) return '';
    if (hit.iata) return `${hit.city} (${hit.iata})`;
    return hit.city || hit.name || '';
}

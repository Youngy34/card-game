let _uid = 0
function uid() { return ++_uid }

function stampCards(cards) {
  return cards.map(c => ({ ...c, _id: uid() }))
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function loadGameData() {
  const files = await fetch('/api/data/list').then(r => r.json())

  let globals = null
  let basics = []
  const characters = []

  for (const file of files) {
    const data = await fetch(`/api/data/${encodeURIComponent(file)}`).then(r => r.json())
    if (data.globals) {
      globals = data.globals
      basics = data.basics
    } else if (data.id) {
      characters.push(data)
    }
  }

  if (!globals) throw new Error('core.json (globals + basics) not found in Character JSON folder')
  if (characters.length === 0) throw new Error('No character files found in Character JSON folder')

  return { globals, basics, characters }
}

export function buildDeck(character, basics) {
  const basicCards = basics.flatMap(b => Array(b.copies).fill(null).map(() => ({ ...b })))
  const sigCards = character.signatureCards.flatMap(c => Array(c.copies).fill(null).map(() => ({ ...c })))
  const deck = stampCards(shuffle([...basicCards, ...sigCards]))
  const superCard = { ...character.superCard, _id: uid() }
  return { deck, superCard }
}

export function drawCards(deck, discard, count) {
  let d = [...deck]
  let disc = [...discard]
  const drawn = []

  for (let i = 0; i < count; i++) {
    if (d.length === 0) {
      if (disc.length === 0) break
      d = stampCards(shuffle(disc))
      disc = []
    }
    drawn.push(d.pop())
  }

  return { deck: d, discard: disc, drawn }
}

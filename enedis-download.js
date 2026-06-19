/*
    Script de téléchargement des données de consommation ENEDIS
    Copyright 2025 Nicolas Joyard
    Licence MIT (voir fichier LICENCE à la racine du dépôt Git)
*/

// Période d'extraction en années - définir à 0 pour utiliser des dates spécifiques
const ANNEES = 1

// Période d'extraction au format YYYY-MM-DD
const DEBUT = '2024-01-04'
const FIN = '2026-01-02'

// Délai entre deux chargements (en secondes, peut être nécessaire de l'augmenter si la duree est très longue)
const delai = 2

// Bibliothèques
const libs = {
    'JSZip': 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
    'luxon': 'https://cdn.jsdelivr.net/npm/luxon@3.7.2/build/global/luxon.min.js'
}
async function loadLibs() {
    for (let [id, url] of Object.entries(libs)) {
        const existing = document.querySelector(`script#temposim-lib-${id}`)
        if (!existing) {
            console.log(`-> chargement de ${id}...`)
            const script = document.createElement('script')
            script.id = `temposim-lib-${id}`
            script.crossOrigin = 'anonymous'
            script.referrerPolicy = 'no-referrer'
            script.src = url
            document.body.appendChild(script)

            let count = 0
            while (!(id in window)) {
                if (count > 10) {
                    throw new Error(`Échec de chargement de la librairie ${id} après 10 secondes d'attente`)
                }

                await delay(1000)
                count++
            }
        }
    }
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

// Parser une date au format DD/MM/YYYY hh:mm:ss
const dateRegex = /(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})/
function parseDate(str) {
    const [, D, M, Y, h, m, s] = str.match(dateRegex)

    return luxon.DateTime.fromISO(
        `${Y}-${M}-${D}T${h}:${m}:${s}`,
        { zone: 'Europe/Paris' }
    )
}

// Calculer les périodes de téléchargement
function computePeriods(years, start_date, end_date) {
    const { DateTime } = luxon

    const min = DateTime.now().minus({ years: 2 })
    
    const end = years == 0
        ? DateTime.fromISO(end_date).endOf('day')
        : DateTime.now().endOf('day')
    
    let start = years == 0
        ? DateTime.fromISO(start_date).startOf('day')
        : end.minus({ years }).startOf('day')

    if (start < min) {
        console.warn(`ENEDIS limite à 2 ans d'historique : la date de début sera le ${min.toISODate()}`)
        start = min
    }

    const periods = []
    for (let cur = start; cur < end; cur = cur.plus({ days: 7 })) {
        let periodEnd = cur.plus({ days: 6 }).endOf('day')
        if (periodEnd > end) {
            periodEnd = end
        }

        periods.push({
            start: cur,
            end: periodEnd
        })
    }

    return periods
}

// Extraire l'identifiant du point de livraison depuis les cookies
function getPRM() {
    const cookies = document.cookie.split('; ')
    const prmCookie = cookies.find(c => c.startsWith('prm-selectionne='))
    const [, idPrm] = prmCookie.split('=')
    
    return idPrm
}

// Récupérer l'ID personne
async function getIdPersonne() {
    const apiRoot = 'https://alex.microapplications.enedis.fr/mon-compte/api/private/v2'
    const url = new URL(`${apiRoot}/userinfos`)
    url.searchParams.set('espace', 'PARTICULIER')

    const req = await fetch(url, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
        mode: 'cors'
    })
    if (!req.ok) {
        throw new Error(`Échec de la récupération de l'ID personne: HTTP ${req.status} / ${req.statusText}`)
    }
    
    const { idPersonne } = await req.json()
    return idPersonne
}

// Télécharger un fichier de conso XLSX et sauvegarder le fichier
async function getFile(idPersonne, idPrm, start, end) {
    const apiRoot = 'https://alex.microapplications.enedis.fr/mes-mesures-prm/api/private/v2'
    const url = new URL(`${apiRoot}/personnes/${idPersonne}/prms/${idPrm}/donnees-energetiques/file`)
    const params = {
        'mesuresTypeCode': 'COURBE',
        'mesuresCorrigees': 'false',
        'typeDonnees': 'CONS',
        'dateDebut': start,
        'dateFin': end,
        'format': 'EXCEL',
        'segments': 'C5'
    }
    
    for (let [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v)
    }

    const req = await fetch(url, { credentials: 'include' })
    if (!req.ok) {
        throw new Error(`Échec de la récupération des données du ${start} au ${end}: HTTP ${req.status} / ${req.statusText}`)
    }
    
    // 2. Convert response to a Blob (Binary Large Object)
    const blob = await req.blob();
  
    // 3. Create a temporary URL pointing to the object
    const downloadUrl = window.URL.createObjectURL(blob);
  
    // 4. Create an invisible anchor element
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${start}.${end}.xlsx`; // Set the default saved filename
  
    // 5. Append, click, and remove the link
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  
    // 6. Clean up the URL object to free up memory
    window.URL.revokeObjectURL(downloadUrl);
}


async function getEnedisData(years, start, end, delay_seconds) {
    try {
        console.log('Chargement des librairies...')
        await loadLibs()

        console.log('Récupération des infos utilisateur...')
        const idPrm = getPRM()
        const idPersonne = await getIdPersonne()
        console.log(`-> ID personne: ${idPersonne}, ID PRM: ${idPrm}`)

        console.log('Calcul des périodes de téléchargement...')
        const periodes = computePeriods(years, start, end)
        const data = []
        console.log(`-> ${periodes.length} téléchargements à faire`)

        console.log('Téléchargement des données...')

        let retried = false;

        for (let i = 0; i < periodes.length; i++) {
            const { start, end } = periodes[i]
            const s = start.toISODate()
            const e = end.toISODate()

            console.log(`[${i+1}/${periodes.length}] Téléchargement des données du ${s} au ${e}...`)
            let file

            try {
                await getFile(idPersonne, idPrm, s, e)
                retried = false;
            } catch(e) {
                if (!retried) {
                    console.log('-> erreur lors du téléchargement, ajout d\'un délai supplémentaire de 10s')
                    await delay(10000)
                    retried = true
                    i--
                    continue
                } else {
                    throw e
                }
            }

            await delay(delay_seconds * 1000);
        }

        console.log('Opération terminée !')
    } catch (e) {
        console.error(e.message)
    }
}

getEnedisData(ANNEES, DEBUT, FIN, delai)

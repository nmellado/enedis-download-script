# Téléchargement des données de consommation ENEDIS

Suite à la refonte du portail utilisateur ENEDIS en 2025, le téléchargement des données de consommation horaire n'est plus possible sur une durée au-delà de 7 jours.  Ce script permet d'automatiser le téléchargement sur plusieurs années et de constituer un seul fichier CSV avec toutes les données.

## Prérequis

* Un compteur communiquant (Linky)
* Un compte ENEDIS (vous pouvez le créer quel que soit votre fournisseur d'électricité)
* Avoir activé l'enregistrement et la collecte des données de consommation sur la page [Enregistrement et collecte de mes données](https://mon-compte-particulier.enedis.fr/enregistrement-collecte-donnees)

## Avertissement de sécurité

L'utilisation de ce script nécessite de coller du code dans la console de développement de votre navigateur.  C'est en général **fortement déconseillé si vous n'êtes pas certain de ce que vous faites** et si vous ne faites pas **100% confiance à l'auteur du code**.  Il est possible par ce biais à l'auteur du code de voler, entre autres, vos identifiants de connexion au site sur lequel vous faites l'opération.

## Utilisation

* Connectez-vous au site ENEDIS et accédez à la page [Suivre ma consommation](https://mon-compte-particulier.enedis.fr/visualiser-vos-mesures-consommation)
* Attendez le chargement complet de la page et l'affichage du graphique
* Ouvrez la console de développement du navigateur (`F12`, `Ctrl+Maj+I` ou `Cmd+Option+I`)
* Accédez à l'onglet "Console" puis collez le contenu du script et appuyez sur Entrée

Par défaut le script effectue le téléchargement sur 1 an. Vous pouvez modifier cette durée aux lignes 7 à 13 du script.

Le script va récupérer progressivement les données pour chaque semaine de la période, avec un délai entre chaque téléchargement (afin d'éviter de déclencher d'éventuelles mesures de protection côté ENEDIS), pour un total d'environ 3 minutes par année téléchargée, puis générer un fichier CSV qui sera automatiquement téléchargé par votre navigateur.

## Format des données

Le fichier généré est au format CSV avec trois colonnes:

* `horodate`: date et heure du début de la période au format ISO
* `duree_h`: durée de la période de mesure en heures
* `puissance_kw`: puissance moyenne mesurée sur la période en kW

Pour calculer l'énergie consommée sur la période en kWh, il suffit de multiplier la puissance en kW par la durée en heures.  Par exemple sur une période d'une-demi heure, une puissance moyenne de 10kW correspond à une consommation de 5kWh.

En général les durées sont toujours d'une demi-heure, mais il arrive parfois qu'ENEDIS renvoie les données sur des durées différentes.

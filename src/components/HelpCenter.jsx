import React, { useEffect, useMemo, useRef } from 'react'
import { LifeBuoy, Lightbulb, BookOpen, AlertTriangle, MessageCircle, ExternalLink, Mail, X } from 'lucide-react'
import { Button } from './ui/button.jsx'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.jsx'
import { ScrollArea } from './ui/scroll-area.jsx'
import { Separator } from './ui/separator.jsx'

const translations = {
  fr: {
    title: 'Centre d\'aide',
    subtitle: 'Réponses express pour Email Assistant v8',
    quickStart: {
      heading: 'Prise en main rapide',
      description: 'Suivez ces étapes pour générer un courriel prêt à envoyer en moins d\'une minute.',
      bullets: [
        'Choisissez un modèle dans la colonne de gauche. Utilisez la recherche et le filtre de catégories pour accélérer.',
        'Ajoutez vos informations : tapez directement dans les zones “Objet” et “Message” ou utilisez le popup Variables pour profiter des mises à jour en temps réel.',
        'Copiez le résultat (objet, corps ou tout) ou composez directement dans Outlook lorsque vous êtes satisfait.'
      ]
    },
    faq: {
      heading: 'Questions fréquentes',
      items: [
        {
          question: 'Comment garder le popup Variables à l\'écran ?',
          answer: 'Cliquez sur l\'icône d\'épingle. Quand elle est active, le panneau reste ouvert même si vous interagissez ailleurs dans l\'application.'
        },
        {
          question: 'Les valeurs du popup correspondent-elles toujours au texte ?',
          answer: 'Oui. À l\'ouverture, le popup synchronise immédiatement les valeurs actuelles grâce à l\'extraction directe de l\'objet et du message. Les modifications faites dans le texte sont détectées automatiquement.'
        },
        {
          question: 'Comment revenir aux valeurs par défaut ?',
          answer: 'Utilisez le bouton Réinitialiser dans l\'éditeur. Il recharge le modèle sélectionné, restaure les valeurs d\'exemple et efface les champs personnalisés.'
        },
        {
          question: 'Puis-je travailler sans connexion ?',
          answer: 'Oui. Tous les traitements se font dans votre navigateur et les données restent locales. Pensez simplement à exporter vos modèles JSON si vous avez fait des modifications.'
        }
      ]
    },
    troubleshooting: {
      heading: 'Dépannage express',
      items: [
        {
          title: 'Le popup ne montre pas les nouvelles valeurs',
          steps: [
            'Fermez puis rouvrez le popup pour déclencher une synchronisation complète.',
            'Vérifiez que vous n\'êtes pas sur un onglet inactif qui bloquerait les BroadcastChannels (certains navigateurs limitent la communication).',
            'Rechargez la page avec ⇧ + ⌘ + R (Mac) ou ⇧ + Ctrl + R (Windows) pour repartir d\'un état propre.'
          ]
        },
        {
          title: 'Le bouton “Ouvrir dans Outlook” ne fait rien',
          steps: [
            'Confirmez qu\'un modèle est sélectionné. Le bouton s\'active uniquement quand un contenu final est disponible.',
            'Certaines organisations bloquent les liens `mailto:`. Dans ce cas, utilisez Copier tout puis collez manuellement dans Outlook.'
          ]
        },
        {
          title: 'Impossible de charger les modèles',
          steps: [
            'Assurez-vous que `complete_email_templates.json` est présent dans `public/` et accessible.',
            'Ouvrez la console réseau du navigateur pour repérer une erreur 404 ou CORS.',
            'Utilisez le paramètre `?debug=1` pour vérifier les compteurs de chargement.'
          ]
        }
      ]
    },
    resources: {
      heading: 'Ressources utiles',
      links: [
        { label: 'Guide complet des fonctionnalités (README)', href: 'https://github.com/snarky1980/email-assistant-v8-blue-highlights-1/blob/main/README.md' },
        { label: 'Notes d\'implantation détaillées', href: 'https://github.com/snarky1980/email-assistant-v8-blue-highlights-1/blob/main/IMPLEMENTATION_CHANGES.md' },
        { label: 'Guide développeur', href: 'https://github.com/snarky1980/email-assistant-v8-blue-highlights-1/blob/main/docs/DEVELOPER-GUIDE.md' },
        { label: 'Aide hors ligne (HTML)', href: './help.html' }
      ]
    },
    contact: {
      heading: 'Besoin d\'un coup de main ?',
      description: 'Nous pouvons vous assister pour les comptes, les modèles ou la synchronisation.',
      button: 'Nous écrire',
      extra: (email) => `Ou écrivez-nous directement à ${email}.`,
      close: 'Fermer le centre d\'aide'
    }
  },
  en: {
    title: 'Help Centre',
    subtitle: 'Get answers fast for Email Assistant v8',
    quickStart: {
      heading: 'Quick start',
      description: 'Follow these steps to produce a ready-to-send message in under a minute.',
      bullets: [
        'Pick a template from the left rail. Use search and category filters to narrow the list.',
        'Add your details: type directly in the Subject and Message areas or open the Variables popout for real-time updates.',
        'Copy the result (subject, body, or everything) or launch Outlook when you\'re happy with the message.'
      ]
    },
    faq: {
      heading: 'Frequently asked questions',
      items: [
        {
          question: 'How do I keep the Variables popout visible?',
          answer: 'Click the pin icon. When it\'s active, the panel stays open even if you interact elsewhere in the app.'
        },
        {
          question: 'Does the popout always match the main editors?',
          answer: 'Yes. Opening the popout triggers an immediate sync that extracts the current subject and body. Text edits are auto-detected and reflected back.'
        },
        {
          question: 'How do I restore default example values?',
          answer: 'Use the Reset button in the editor. It reloads the selected template, restores example values, and clears custom text fields.'
        },
        {
          question: 'Can I work offline?',
          answer: 'Absolutely. Everything runs in your browser and data stays local. Remember to export your JSON templates if you made edits.'
        }
      ]
    },
    troubleshooting: {
      heading: 'Troubleshooting checklist',
      items: [
        {
          title: 'Popout is missing recent edits',
          steps: [
            'Close and reopen the popout to force a full refresh.',
            'Make sure the tab stays active—some browsers pause BroadcastChannels in background tabs.',
            'Hard reload with ⇧ + ⌘ + R (Mac) or ⇧ + Ctrl + R (Windows) to clear cached state.'
          ]
        },
        {
          title: '“Open in Outlook” button does nothing',
          steps: [
            'Confirm that a template is selected. The button is enabled only when final content is available.',
            'Some organizations block `mailto:` links. If that\'s the case, use Copy all and paste into Outlook manually.'
          ]
        },
        {
          title: 'Templates refuse to load',
          steps: [
            'Ensure `complete_email_templates.json` lives in `public/` and can be fetched.',
            'Open the browser network console to look for 404 or CORS errors.',
            'Append `?debug=1` to the URL to inspect loading counters.'
          ]
        }
      ]
    },
    resources: {
      heading: 'Helpful resources',
      links: [
        { label: 'Feature guide (README)', href: 'https://github.com/snarky1980/email-assistant-v8-blue-highlights-1/blob/main/README.md' },
        { label: 'Implementation notes', href: 'https://github.com/snarky1980/email-assistant-v8-blue-highlights-1/blob/main/IMPLEMENTATION_CHANGES.md' },
        { label: 'Developer guide', href: 'https://github.com/snarky1980/email-assistant-v8-blue-highlights-1/blob/main/docs/DEVELOPER-GUIDE.md' },
        { label: 'Offline help (HTML)', href: './help.html' }
      ]
    },
    contact: {
      heading: 'Still need a hand?',
      description: 'The Translation Bureau team can help with accounts, templates, or synchronization questions.',
      button: 'Contact support',
      extra: (email) => `Or email us directly at ${email}.`,
      close: 'Close help centre'
    }
  }
}

function SectionHeader({ icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-lg border border-[#bfe7e3] bg-[#f0fbfb] text-[#145a64]">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-[#123a45]">{title}</h3>
        {description ? <p className="text-sm text-slate-600">{description}</p> : null}
      </div>
    </div>
  )
}

export default function HelpCenter({ language = 'fr', onClose, supportEmail = 'jskennedy80@gmail.com', mailSubject = 'Email Assistant v8 – Support' }) {
  const strings = useMemo(() => translations[language] || translations.fr, [language])
  const closeBtnRef = useRef(null)

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose?.()
      }
    }

    document.addEventListener('keydown', handleKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    requestAnimationFrame(() => {
      closeBtnRef.current?.focus()
    })

    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  const handleContact = () => {
    const subject = encodeURIComponent(mailSubject)
    const mailto = `mailto:${supportEmail}?subject=${subject}`
    window.open(mailto, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center px-4 py-6">
      <div
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-centre-title"
        className="relative z-10 flex w-full max-w-4xl flex-col border-0 bg-white/95 shadow-2xl"
        style={{ borderRadius: '18px', height: '88vh', maxHeight: '88vh' }}
      >
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
          <div>
            <div className="flex items-center gap-2 text-[#145a64]">
              <LifeBuoy className="h-5 w-5" aria-hidden="true" />
              <span className="text-sm font-semibold uppercase tracking-wide">Email Assistant</span>
            </div>
            <CardTitle id="help-centre-title" className="text-2xl font-bold text-[#0f2c33]">
              {strings.title}
            </CardTitle>
            <p className="mt-1 text-sm text-slate-600">{strings.subtitle}</p>
          </div>
          <Button
            ref={closeBtnRef}
            variant="ghost"
            onClick={onClose}
            className="h-9 w-9 rounded-full border border-slate-200 text-slate-500 hover:text-slate-900"
            aria-label={strings.contact.close}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex-1 pt-0" style={{ minHeight: 0 }}>
          <ScrollArea className="h-full w-full pr-2">
            <div className="space-y-8 pb-4">
              <section>
                <SectionHeader
                  icon={Lightbulb}
                  title={strings.quickStart.heading}
                  description={strings.quickStart.description}
                />
                <ul className="mt-4 space-y-2 text-sm text-slate-700">
                  {strings.quickStart.bullets.map((item, index) => (
                    <li key={index} className="flex gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#1f8a99]" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <Separator className="bg-[#e6eef5]" />

              <section>
                <SectionHeader icon={BookOpen} title={strings.faq.heading} />
                <div className="mt-4 space-y-4">
                  {strings.faq.items.map((item, index) => (
                    <div key={index} className="rounded-lg border border-[#e1eff4] bg-[#f9feff] p-4 shadow-sm">
                      <p className="font-semibold text-[#124a52]">{item.question}</p>
                      <p className="mt-2 text-sm text-slate-700">{item.answer}</p>
                    </div>
                  ))}
                </div>
              </section>

              <Separator className="bg-[#e6eef5]" />

              <section>
                <SectionHeader icon={AlertTriangle} title={strings.troubleshooting.heading} />
                <div className="mt-4 space-y-5">
                  {strings.troubleshooting.items.map((block, index) => (
                    <div key={index} className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-4 shadow-sm">
                      <h4 className="text-sm font-semibold text-[#92400e]">{block.title}</h4>
                      <ul className="mt-3 space-y-1.5 text-sm text-[#78350f]">
                        {block.steps.map((step, stepIndex) => (
                          <li key={stepIndex} className="flex gap-2">
                            <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#f59e0b]" aria-hidden="true" />
                            <span>{step}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>

              <Separator className="bg-[#e6eef5]" />

              <section>
                <SectionHeader icon={MessageCircle} title={strings.resources.heading} />
                <ul className="mt-4 grid gap-2 text-sm text-[#145a64] md:grid-cols-2">
                  {strings.resources.links.map((link) => (
                    <li key={link.href}>
                      <a
                        className="group inline-flex items-center gap-2 rounded-lg border border-transparent px-3 py-2 transition-colors duration-150 hover:border-[#bfe7e3] hover:bg-[#f0fbfb]"
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-[#1f8a99] transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
                        <span>{link.label}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>

              <Separator className="bg-[#e6eef5]" />

              <section className="rounded-2xl border border-[#bfe7e3] bg-[#f5fffb] p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-[#145a64]">
                      <Mail className="h-5 w-5" aria-hidden="true" />
                      <h3 className="text-lg font-semibold">{strings.contact.heading}</h3>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{strings.contact.description}</p>
                    <p className="mt-1 text-xs text-slate-500">{strings.contact.extra(supportEmail)}</p>
                  </div>
                  <div className="flex flex-col gap-2 md:items-end">
                    <Button
                      onClick={handleContact}
                      className="bg-[#1f8a99] text-white hover:bg-[#166f7b]"
                    >
                      {strings.contact.button}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={onClose}
                      className="text-[#145a64] hover:bg-[#f0fbfb]"
                    >
                      {strings.contact.close}
                    </Button>
                  </div>
                </div>
              </section>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}

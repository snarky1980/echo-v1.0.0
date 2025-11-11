import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Edit3, X, RotateCcw, Pin, PinOff } from 'lucide-react'

const LANGUAGE_SUFFIXES = ['FR', 'EN']

const expandVariableAssignment = (varName, value) => {
  const assignments = {}
  if (!varName) return assignments
  assignments[varName] = value
  const match = varName.match(/^(.*)_(FR|EN)$/i)
  if (match) {
    const base = match[1]
    assignments[base] = value
  } else {
    LANGUAGE_SUFFIXES.forEach((suffix) => {
      assignments[`${varName}_${suffix}`] = value
    })
  }
  return assignments
}

const applyAssignments = (prev = {}, assignments = {}) => {
  const keys = Object.keys(assignments || {})
  if (!keys.length) return prev
  let hasDiff = false
  const next = { ...prev }
  keys.forEach((key) => {
    const normalized = (assignments[key] ?? '').toString()
    if ((next[key] ?? '') !== normalized) {
      next[key] = normalized
      hasDiff = true
    }
  })
  return hasDiff ? next : prev
}

const resolveVariableInfo = (templatesData, name = '') => {
  if (!templatesData?.variables || !name) return null
  if (templatesData.variables[name]) return templatesData.variables[name]
  const baseName = name.replace(/_(FR|EN)$/i, '')
  return templatesData.variables[baseName] || null
}

const guessSampleValue = (templatesData, name = '') => {
  const info = resolveVariableInfo(templatesData, name)
  if (info?.example) return info.example
  const normalized = (name || '').toLowerCase()
  const format = info?.format || (
    /date|jour|day/.test(normalized) ? 'date' :
    /heure|time/.test(normalized) ? 'time' :
    /montant|total|nombre|count|amount|num|quant/.test(normalized) ? 'number' :
    'text'
  )
  switch (format) {
    case 'date':
      return new Date().toISOString().slice(0, 10)
    case 'time':
      return '09:00'
    case 'number':
      return '0'
    default:
      return '…'
  }
}

/**
 * Standalone Variables Editor Popout Window
 * 
 * This component renders in a separate browser window (popout) and allows
 * editing of template variables. Changes are synced back to the main window
 * via BroadcastChannel.
 */
export default function VariablesPopout({ 
  selectedTemplate, 
  templatesData, 
  initialVariables, 
  interfaceLanguage 
}) {
  console.log('🔍 VariablesPopout props:', {
    selectedTemplate: selectedTemplate?.id,
    templatesData: !!templatesData,
    initialVariables,
    interfaceLanguage
  })
  
  const [variables, setVariables] = useState(initialVariables || {})
  const getVarValue = useCallback((name) => (
    variables?.[name] ??
    variables?.[`${name}_EN`] ??
    variables?.[`${name}_FR`] ??
    ''
  ), [variables])
  const [isPinned, setIsPinned] = useState(() => {
    try {
      return localStorage.getItem('ea_popout_pinned') === 'true'
    } catch {
      return false
    }
  })
  
  console.log('🔍 VariablesPopout initialized with variables:', variables)
  const [focusedVar, setFocusedVar] = useState(null)
  const channelRef = useRef(null)
  const senderIdRef = useRef(Math.random().toString(36).slice(2))
  const retryIntervalRef = useRef(null)
  const varInputRefs = useRef({})
  const focusedVarRef = useRef(focusedVar)
  const sendTimerRef = useRef(null)
  const lastSentAtRef = useRef(0)
  const lastScrollFocusRef = useRef(null)

  useEffect(() => {
    focusedVarRef.current = focusedVar
  }, [focusedVar])

  useEffect(() => {
    try {
      localStorage.setItem('ea_popout_pinned', String(isPinned))
    } catch (err) {
      console.warn('Failed to persist popout pin state:', err)
    }
    if (isPinned) {
      window.focus()
    }
  }, [isPinned])

  useEffect(() => {
    if (!isPinned) return

    let focusThrottle = false

    const refocus = () => {
      if (!isPinned || focusThrottle) return
      focusThrottle = true
      requestAnimationFrame(() => {
        try { window.focus() } catch {}
        setTimeout(() => { focusThrottle = false }, 120)
      })
    }

    const handleBlur = () => {
      setTimeout(refocus, 0)
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        refocus()
      }
    }

    window.addEventListener('blur', handleBlur)
    document.addEventListener('visibilitychange', handleVisibility)

    const intervalId = setInterval(() => {
      if (!isPinned) return
      if (document.visibilityState === 'hidden') {
        refocus()
      }
    }, 3000)

    return () => {
      window.removeEventListener('blur', handleBlur)
      document.removeEventListener('visibilitychange', handleVisibility)
      clearInterval(intervalId)
    }
  }, [isPinned])

  const notifyFocusChange = (varName, broadcast = true) => {
    const next = varName ?? null
    const previous = focusedVarRef.current ?? null
    if (previous === next) {
      if (!broadcast) return
    } else {
      focusedVarRef.current = next
      setFocusedVar(next)
      lastScrollFocusRef.current = next
    }

    if (!broadcast || !channelRef.current) return

    try {
      channelRef.current.postMessage({
        type: 'focusedVar',
        varName: next,
        sender: senderIdRef.current
      })
    } catch (e) {
      console.error('Failed to send focus update:', e)
    }
  }

  const notifyHoverChange = (varName) => {
    if (!channelRef.current) return
    try {
      channelRef.current.postMessage({
        type: 'variableHovered',
        varName: varName ?? null,
        sender: senderIdRef.current
      })
    } catch (e) {
      console.error('Failed to send hover update:', e)
    }
  }

  // Initialize BroadcastChannel for syncing with main window
  useEffect(() => {
    try {
      const channel = new BroadcastChannel('email-assistant-sync')
      channelRef.current = channel
      console.log('🔍 BroadcastChannel created successfully')

      // Listen for messages from main window
      channel.onmessage = (event) => {
        try {
          const message = event.data
          if (!message || message.sender === senderIdRef.current) return

          console.log('🔍 Received message:', message.type, message)

          if (message.type === 'focusedVar') {
            const next = message.varName ?? null
            notifyFocusChange(next, false)

            // Reflect focus visually on cards immediately
            document.querySelectorAll('.ea-popout-card').forEach((card) => {
              const cardVar = card.getAttribute('data-var')
              if (cardVar === next) {
                card.classList.add('ea-popout-focused')
                if (lastScrollFocusRef.current !== next) {
                  try {
                    card.scrollIntoView({ block: 'center', behavior: 'smooth' })
                    lastScrollFocusRef.current = next
                  } catch {}
                }
              } else {
                card.classList.remove('ea-popout-focused')
              }

              const textarea = card.querySelector('textarea')
              if (textarea) {
                if (cardVar === next) {
                  textarea.classList.add('ea-popout-input-focused')
                } else {
                  textarea.classList.remove('ea-popout-input-focused')
                }
              }
            })

            if (!next) {
              lastScrollFocusRef.current = null
            }
            return
          }

          if (message.type === 'variableHovered') {
            // Update hover styling on cards when main window hovers over pills
            const hoveredVar = message.varName ?? null
            document.querySelectorAll('.ea-popout-card').forEach((card) => {
              const cardVarName = card.getAttribute('data-var')
              if (cardVarName === hoveredVar) {
                card.classList.add('ea-popout-hovered')
              } else {
                card.classList.remove('ea-popout-hovered')
              }
            })
            return
          }

          if (message.type === 'variablesUpdated') {
            console.log('🔍 Updating variables from variablesUpdated:', message.variables)
            setVariables(message.variables || {})
            return
          }
          
          // Handle sync completion (from explicit syncFromText requests)
          if (message.type === 'syncComplete') {
            console.log('🔄 Received sync completion:', message)
            const nextVariables = message.variables || {}
            console.log('🔄 Applying sync result variables:', nextVariables)
            setVariables(nextVariables)
            return
          }
        } catch (msgError) {
          console.error('Error processing BroadcastChannel message:', msgError)
        }
      }

      return () => {
        try {
          channel.close()
        } catch (closeError) {
          console.error('Error closing BroadcastChannel:', closeError)
        }
      }
    } catch (e) {
      console.error('BroadcastChannel not available:', e)
    }
  }, [])

  // Wait for initial variables from main window via variablesUpdated message
  // No need to request syncFromText - main window will send variablesUpdated when popout opens
  useEffect(() => {
    if (!channelRef.current) return
    
    console.log('🔄 Popout ready - waiting for initial variables from main window')
    
    // The main window will send variablesUpdated when it detects popoutOpened
    // We just need to wait for it
    
    return () => {
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current)
        retryIntervalRef.current = null
      }
    }
  }, [])

  // Sync variable changes to main window
  const enqueueVariableUpdate = (varName, value, allVariables) => {
    if (!channelRef.current) return

    const sendNow = () => {
      if (!channelRef.current) return
      try {
        channelRef.current.postMessage({
          type: 'variableChanged',
          varName,
          value,
          allVariables,
          sender: senderIdRef.current
        })
        lastSentAtRef.current = Date.now()
      } catch (e) {
        console.error('Failed to send variable update:', e)
      }
    }

    const since = Date.now() - lastSentAtRef.current
    if (since > 60) {
      sendNow()
    } else {
      clearTimeout(sendTimerRef.current)
      sendTimerRef.current = setTimeout(sendNow, Math.max(0, 60 - since))
    }
  }

  const updateVariable = (varName, value) => {
    let pending = null
    const assignments = expandVariableAssignment(varName, value)
    setVariables(prev => {
      const next = applyAssignments(prev, assignments)
      if (next !== prev) {
        pending = next
      }
      return next
    })

    const snapshot = pending || variables
    enqueueVariableUpdate(varName, value, snapshot)
  }

  const removeVariable = (varName) => {
    let pending = null
    const assignments = expandVariableAssignment(varName, '')
    setVariables(prev => {
      const next = applyAssignments(prev, assignments)
      if (next !== prev) {
        pending = next
      }
      return next
    })

    const snapshot = pending || variables
    enqueueVariableUpdate(varName, '', snapshot)

    if (!channelRef.current) return

    try {
      channelRef.current.postMessage({
        type: 'variableRemoved',
        varName,
        allVariables: snapshot,
        sender: senderIdRef.current
      })
    } catch (e) {
      console.error('Failed to send variable removal:', e)
    }
  }

  const reinitializeVariable = (varName) => {
    const exampleValue = guessSampleValue(templatesData, varName)
    let pending = null
    const assignments = expandVariableAssignment(varName, exampleValue)
    setVariables(prev => {
      const next = applyAssignments(prev, assignments)
      if (next !== prev) {
        pending = next
      }
      return next
    })

    const snapshot = pending || variables
    enqueueVariableUpdate(varName, exampleValue, snapshot)

    if (!channelRef.current) return

    try {
      channelRef.current.postMessage({
        type: 'variableReinitialized',
        varName,
        value: exampleValue,
        sender: senderIdRef.current
      })
    } catch (e) {
      console.error('Failed to send variable reinitialization:', e)
    }
  }

  useEffect(() => () => { clearTimeout(sendTimerRef.current) }, [])
  
  // Auto-focus first empty variable on mount
  useEffect(() => {
    if (!selectedTemplate?.variables || selectedTemplate.variables.length === 0) return
    
    try {
      const firstEmpty = selectedTemplate.variables.find(
        (vn) => !getVarValue(vn).trim()
      ) || selectedTemplate.variables[0]
      
      const el = varInputRefs.current?.[firstEmpty]
      if (el && typeof el.focus === 'function') {
        setTimeout(() => {
          try {
            el.focus()
            if (typeof el.select === 'function') {
              el.select()
            }
          } catch (focusError) {
            console.warn('Focus error:', focusError)
          }
        }, 100)
      }
    } catch (error) {
      console.error('Auto-focus error:', error)
    }
  }, [])

  if (!selectedTemplate || !templatesData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  const t = interfaceLanguage === 'fr' ? {
    title: 'Modifier les variables',
    reinitialize: 'Réinitialiser',
    clear: 'Supprimer',
    close: 'Fermer',
    pin: ({ pinned }) => pinned ? 'Épinglé • cette fenêtre reste devant' : 'Épingler cette fenêtre'
  } : {
    title: 'Edit Variables',
    reinitialize: 'Reinitialize',
    clear: 'Delete',
    close: 'Close',
    pin: ({ pinned }) => pinned ? 'Pinned • window stays on top' : 'Pin this window'
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div 
        className="sticky top-0 z-10 px-6 py-2 flex items-center justify-between"
        style={{ 
          background: '#2c3d50',
          borderBottom: '3px solid rgba(163, 179, 84, 0.3)'
        }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center">
            <Edit3 className="h-5 w-5 mr-2 text-white" />
            <h1 className="text-lg font-bold text-white">{t.title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPinned((prev) => !prev)}
            className={`rounded-lg p-2 transition-colors ${isPinned ? 'bg-white/20 text-white' : 'text-white hover:bg-white/20'}`}
            title={t.pin({ pinned: isPinned })}
          >
            {isPinned ? <Pin className="h-5 w-5" /> : <PinOff className="h-5 w-5" />}
          </button>
          <button
            onClick={() => window.close()}
            className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
            title={t.close}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Variables Grid */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-7xl mx-auto">
          {(selectedTemplate?.variables || []).map((varName) => {
            const varInfo = templatesData?.variables?.[varName]
            if (!varInfo) {
              console.warn('🔍 Variable info not found for:', varName)
              return null
            }

            const currentValue = getVarValue(varName)
            const isFocused = (focusedVar === varName)
            const sanitizedVarId = `popout-var-${varName.replace(/[^a-z0-9_-]/gi, '-')}`

            return (
              <div
                key={varName}
                data-var={varName}
                className={`ea-popout-card rounded-lg p-3 transition-all duration-200 ${isFocused ? 'ea-popout-focused' : ''}`}
                style={isFocused ? {
                  background: 'rgba(219, 234, 254, 0.35)',
                  border: '2px solid rgba(29, 78, 216, 0.6)',
                  boxShadow: '0 0 0 3px rgba(29, 78, 216, 0.25), 0 8px 24px rgba(30, 64, 175, 0.25)',
                  transform: 'scale(1.02)'
                } : undefined}
                onMouseEnter={() => notifyHoverChange(varName)}
                onMouseLeave={() => notifyHoverChange(null)}
              >
                <div className="ea-popout-card-inner rounded-lg p-4">
                  {/* Label and buttons */}
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <label htmlFor={sanitizedVarId} className="text-sm font-semibold text-gray-900 flex-1 leading-tight">
                      {varInfo.description?.[interfaceLanguage] || varName}
                    </label>
                    <div className="shrink-0 flex items-center gap-1 opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button
                        className="text-xs px-2 py-0.5 rounded border border-gray-300 text-teal-700 hover:bg-teal-50 flex items-center gap-1"
                        title={t.reinitialize}
                        onClick={() => reinitializeVariable(varName)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {t.reinitialize}
                      </button>
                      <button
                        className="text-xs px-2 py-0.5 rounded border border-gray-300 text-red-700 hover:bg-red-50"
                        title={t.clear}
                        onClick={() => removeVariable(varName)}
                      >
                        X
                      </button>
                    </div>
                  </div>

                  {/* Input field */}
                  <textarea
                    ref={el => { if (el) varInputRefs.current[varName] = el }}
                    id={sanitizedVarId}
                    name={sanitizedVarId}
                    value={currentValue}
                    onChange={(e) => updateVariable(varName, e.target.value)}
                    onFocus={(e) => {
                      notifyFocusChange(varName)
                      requestAnimationFrame(() => {
                        try {
                          e.target.select()
                        } catch {}
                      })
                    }}
                    onBlur={() => notifyFocusChange(null)}
                    onKeyDown={(e) => {
                      // Tab or Enter to next field
                      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
                        e.preventDefault()
                        const list = selectedTemplate.variables
                        const currentIdx = list.indexOf(varName)
                        
                        let nextIdx
                        if (e.shiftKey && e.key === 'Tab') {
                          // Shift+Tab = previous
                          nextIdx = (currentIdx - 1 + list.length) % list.length
                        } else {
                          // Tab or Enter = next
                          nextIdx = (currentIdx + 1) % list.length
                        }
                        
                        const nextVar = list[nextIdx]
                        const el = varInputRefs.current[nextVar]
                        if (el && el.focus) {
                          el.focus()
                          el.select?.()
                        }
                      }
                    }}
                    placeholder={varInfo.example || ''}
                    className={`w-full min-h-[32px] border-2 border-gray-200 rounded-md resize-none transition-all duration-200 text-sm px-2 py-1 leading-5 focus:border-blue-600 focus:ring-2 focus:ring-blue-200 ${isFocused ? 'ea-popout-input-focused' : ''}`}
                    style={{
                      height: (() => {
                        const lines = (currentValue.match(/\n/g) || []).length + 1
                        return lines <= 2 ? (lines === 1 ? '32px' : '52px') : '52px'
                      })()
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

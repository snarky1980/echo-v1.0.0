import React, { useState, useEffect, useRef } from 'react'
import { Edit3, X, RefreshCw } from 'lucide-react'

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
  
  console.log('🔍 VariablesPopout initialized with variables:', variables)
  const [focusedVar, setFocusedVar] = useState(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState(null)
  const channelRef = useRef(null)
  const senderIdRef = useRef(Math.random().toString(36).slice(2))
  const retryIntervalRef = useRef(null)
  const varInputRefs = useRef({})

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

          if (message.type === 'variablesUpdated') {
            console.log('🔍 Updating variables from variablesUpdated:', message.variables)
            setVariables(message.variables || {})
            // Stop retrying initial sync if any
            if (retryIntervalRef.current) {
              clearInterval(retryIntervalRef.current)
              retryIntervalRef.current = null
              setIsSyncing(false)
            }
          }
          
          // Handle sync completion
          if (message.type === 'syncComplete') {
            console.log('🔄 Received sync completion:', message)
            setIsSyncing(false)
            if (message.success) {
              console.log('🔄 Updating variables with synced values:', message.variables)
              setVariables(message.variables || {})
              setSyncStatus('success')
              setTimeout(() => setSyncStatus(null), 2000)
            } else {
              console.log('🔄 No changes found during sync')
              setSyncStatus('no-changes')
              setTimeout(() => setSyncStatus(null), 2000)
            }
            // Stop retrying initial sync if any
            if (retryIntervalRef.current) {
              clearInterval(retryIntervalRef.current)
              retryIntervalRef.current = null
            }
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

  // Request one-time sync from main window on mount so popout reflects current editor content
  useEffect(() => {
    if (!channelRef.current) return
    // Add a small delay to ensure main window's BroadcastChannel handler is ready
    // Implement a retry loop so we robustly request syncFromText until the
    // main window responds (or we give up after a few attempts). This helps
    // in cases where handlers are not yet ready due to timing/race conditions.
    let attempts = 0
    const maxAttempts = 6
    const intervalMs = 150
    setIsSyncing(true)
    const sendSyncRequest = () => {
      attempts += 1
      try {
        console.log(`🔄 Requesting initial sync from main window (attempt ${attempts})`)
        channelRef.current.postMessage({ type: 'syncFromText', sender: senderIdRef.current })
      } catch (e) {
        console.error('Failed to request initial syncFromText:', e)
      }
    }

    // Start immediately after a short delay
    const initialTimeout = setTimeout(() => sendSyncRequest(), 80)
    retryIntervalRef.current = setInterval(() => {
      if (attempts >= maxAttempts) {
        clearInterval(retryIntervalRef.current)
        retryIntervalRef.current = null
        setIsSyncing(false)
        console.warn('🔄 Initial sync attempts exhausted; falling back to initial variables')
        return
      }
      sendSyncRequest()
    }, intervalMs)

    return () => {
      clearTimeout(initialTimeout)
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current)
        retryIntervalRef.current = null
      }
    }
  }, [])

  // Sync variable changes to main window
  const updateVariable = (varName, value) => {
    const newVariables = { ...variables, [varName]: value }
    setVariables(newVariables)

    // Send update to main window
    if (channelRef.current) {
      try {
        channelRef.current.postMessage({
          type: 'variableChanged',
          varName,
          value,
          allVariables: newVariables,
          sender: senderIdRef.current
        })
      } catch (e) {
        console.error('Failed to send variable update:', e)
      }
    }
  }
  
  // Request sync from text areas in main window
  const handleSyncFromText = () => {
    if (!channelRef.current) return
    
    setIsSyncing(true)
    setSyncStatus(null)
    
    try {
      channelRef.current.postMessage({
        type: 'syncFromText',
        sender: senderIdRef.current
      })
    } catch (e) {
      console.error('Failed to request sync:', e)
      setIsSyncing(false)
      setSyncStatus('error')
      setTimeout(() => setSyncStatus(null), 2000)
    }
  }

  // Auto-focus first empty variable on mount
  useEffect(() => {
    if (!selectedTemplate?.variables || selectedTemplate.variables.length === 0) return
    
    try {
      const firstEmpty = selectedTemplate.variables.find(
        vn => !(variables[vn] || '').trim()
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
    resetExample: 'Remettre l\'exemple',
    clear: 'Effacer',
    close: 'Fermer',
    syncFromText: 'Synchroniser depuis le texte',
    syncing: 'Synchronisation...',
    syncSuccess: 'Synchronis\u00e9 !',
    syncNoChanges: 'Aucun changement',
    syncError: 'Erreur'
  } : {
    title: 'Edit Variables',
    resetExample: 'Reset to example',
    clear: 'Clear',
    close: 'Close',
    syncFromText: 'Sync from text',
    syncing: 'Syncing...',
    syncSuccess: 'Synced!',
    syncNoChanges: 'No changes',
    syncError: 'Error'
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div 
        className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between"
        style={{ 
          background: 'linear-gradient(135deg, #145a64 0%, #1a7a87 100%)',
          borderBottom: '3px solid rgba(139, 195, 74, 0.3)'
        }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center">
            <Edit3 className="h-5 w-5 mr-2 text-white" />
            <h1 className="text-lg font-bold text-white">{t.title}</h1>
          </div>
          
          {/* Sync from text button */}
          <button
            onClick={handleSyncFromText}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={t.syncFromText}
          >
            <RefreshCw className={`h-4 w-4 text-white ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="text-sm font-semibold text-white">
              {isSyncing ? t.syncing : syncStatus === 'success' ? t.syncSuccess : syncStatus === 'no-changes' ? t.syncNoChanges : syncStatus === 'error' ? t.syncError : t.syncFromText}
            </span>
          </button>
        </div>
        
        <button
          onClick={() => window.close()}
          className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
          title={t.close}
        >
          <X className="h-5 w-5" />
        </button>
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

            const currentValue = variables[varName] || ''
            const isFocused = focusedVar === varName
            const sanitizedVarId = `popout-var-${varName.replace(/[^a-z0-9_-]/gi, '-')}`

            return (
              <div
                key={varName}
                className="rounded-lg p-3 transition-all duration-200"
                style={{
                  background: isFocused
                    ? 'rgba(59, 130, 246, 0.15)'
                    : 'rgba(200, 215, 150, 0.4)',
                  border: isFocused
                    ? '2px solid rgba(59, 130, 246, 0.4)'
                    : '1px solid rgba(190, 210, 140, 0.6)',
                  boxShadow: isFocused
                    ? '0 0 0 3px rgba(59, 130, 246, 0.1)'
                    : 'none'
                }}
              >
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  {/* Label and buttons */}
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <label htmlFor={sanitizedVarId} className="text-sm font-semibold text-gray-900 flex-1 leading-tight">
                      {varInfo.description?.[interfaceLanguage] || varName}
                    </label>
                    <div className="shrink-0 flex items-center gap-1 opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button
                        className="text-xs px-2 py-0.5 rounded border border-gray-300 text-teal-700 hover:bg-teal-50"
                        title={t.resetExample}
                        onClick={() => updateVariable(varName, varInfo.example || '')}
                      >
                        Ex.
                      </button>
                      <button
                        className="text-xs px-2 py-0.5 rounded border border-gray-300 text-red-700 hover:bg-red-50"
                        title={t.clear}
                        onClick={() => updateVariable(varName, '')}
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
                    onFocus={() => setFocusedVar(varName)}
                    onBlur={() => setFocusedVar(prev => prev === varName ? null : prev)}
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
                    className="w-full min-h-[32px] border-2 border-gray-200 rounded-md resize-none transition-all duration-200 text-sm px-2 py-1 leading-5 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
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

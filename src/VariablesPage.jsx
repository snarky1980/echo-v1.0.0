import React, { useState, useEffect } from 'react'
import VariablesPopout from './VariablesPopout'

/**
 * Variables Page - Renders when ?varsOnly=1 is in URL
 * 
 * This page loads the template data and renders the Variables popout interface.
 * It receives template ID and language from URL parameters and syncs with the
 * main window via BroadcastChannel.
 */
export default function VariablesPage() {
  const [templatesData, setTemplatesData] = useState(null)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [variables, setVariables] = useState({})
  const [interfaceLanguage, setInterfaceLanguage] = useState('fr')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Parse URL parameters
    const params = new URLSearchParams(window.location.search)
    const templateId = params.get('id')
    const lang = params.get('lang') || 'fr'
    
    setInterfaceLanguage(lang)

    // Load templates data
    const loadData = async () => {
      try {
        const response = await fetch('./complete_email_templates.json')
        const data = await response.json()
        setTemplatesData(data)

        // Find the selected template
        if (templateId && data.templates) {
          const template = data.templates.find(t => t.id === templateId)
          if (template) {
            setSelectedTemplate(template)
            
            // Initialize variables as empty - let sync mechanism populate with current values
            const initialVars = {}
            if (template.variables) {
              template.variables.forEach(varName => {
                initialVars[varName] = '' // Start empty, sync will populate
              })
            }
            setVariables(initialVars)
          }
        }
      } catch (error) {
        console.error('Failed to load templates:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()

    // Listen for variable updates from main window via BroadcastChannel
    let channel
    try {
      channel = new BroadcastChannel('email-assistant-sync')
      channel.onmessage = (event) => {
        const data = event.data
        if (data.type === 'variablesUpdated') {
          console.log('📋 Variables page received variablesUpdated:', data.variables)
          setVariables(data.variables)
        }
        // Also handle sync completion in case popout and page are both open
        if (data.type === 'syncComplete' && data.success) {
          console.log('📋 Variables page received syncComplete:', data.variables)
          setVariables(data.variables)
        }
      }
    } catch (e) {
      console.error('BroadcastChannel not available:', e)
    }

    return () => {
      if (channel) channel.close()
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {interfaceLanguage === 'fr' ? 'Chargement...' : 'Loading...'}
          </p>
        </div>
      </div>
    )
  }

  if (!selectedTemplate || !templatesData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 text-lg">
            {interfaceLanguage === 'fr' 
              ? 'Modèle non trouvé' 
              : 'Template not found'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <VariablesPopout
      selectedTemplate={selectedTemplate}
      templatesData={templatesData}
      initialVariables={variables}
      interfaceLanguage={interfaceLanguage}
    />
  )
}

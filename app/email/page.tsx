'use client'

import { useState, useEffect } from 'react'
import { 
  Mail, 
  Plus, 
  Edit, 
  Trash2, 
  Send, 
  Users, 
  Calendar, 
  Clock, 
  Target,
  Search, 
  Filter,
  CheckSquare,
  Square,
  Play,
  Pause,
  Settings
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import apiClient from '@/lib/api-client'

// Helper function to calculate recommended email interval
const calculateRecommendedInterval = (dailyLimit: number, startTime: string, endTime: string, selectedLeadsCount: number = 0): number => {
  if (!dailyLimit || dailyLimit <= 0) return 10
  
  // Parse time strings to get hours
  const [startHour, startMin] = startTime.split(':').map(Number)
  const [endHour, endMin] = endTime.split(':').map(Number)
  
  // Calculate total minutes in the sending window
  let totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin)
  
  // Handle case where end time is next day (e.g., 22:00 to 08:00)
  if (totalMinutes <= 0) {
    totalMinutes = (24 * 60) + totalMinutes
  }
  
  // Use the smaller value between daily limit and selected leads count
  // If selected leads is less than daily limit, space them out properly
  const effectiveLimit = selectedLeadsCount > 0 ? Math.min(dailyLimit, selectedLeadsCount) : dailyLimit
  
  // Calculate interval to evenly space emails
  const recommendedInterval = Math.floor(totalMinutes / effectiveLimit)
  
  // Ensure minimum interval of 1 minute and maximum of 1440 minutes (24 hours)
  return Math.max(1, Math.min(1440, recommendedInterval))
}

interface EmailTemplate {
  id: string
  subject: string
  body: string
  persona: string
  stage: string
  createdAt: string
  usageCount: number
}

interface Lead {
  id: string
  full_name: string
  first_name: string
  last_name: string
  email: string
  email_address: string
  job_title: string
  company_name: string
  linkedin_url: string
  icp_score: number
  email_status: string
}

interface EmailCampaign {
  id: string
  name: string
  templateId: string
  templateSubject: string
  selectedLeads: string[]
  status: 'draft' | 'active' | 'paused' | 'completed'
  totalLeads: number
  sentCount: number
  scheduledCount: number
  openRate: number
  replyRate: number
  emailInterval: number // minutes between emails
  dailyLimit: number
  sendTimeStart: string // e.g., "07:00"
  sendTimeEnd: string // e.g., "09:00"
  timezone: string
  createdAt: string
  nextSendTime?: string
}

interface CampaignFormData {
  name: string
  templateId: string
  selectedLeads: string[]
  emailInterval: number
  dailyLimit: number
  sendTimeStart: string
  sendTimeEnd: string
  timezone: string
}

export default function EmailManagementPage() {
  const [activeTab, setActiveTab] = useState<'campaigns' | 'templates' | 'create-campaign'>('campaigns')
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterPersona, setFilterPersona] = useState('')
  const [filterStage, setFilterStage] = useState('')
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])
  const [showCreateCampaign, setShowCreateCampaign] = useState(false)
  const [showCreateTemplate, setShowCreateTemplate] = useState(false)
  const [showEditTemplate, setShowEditTemplate] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null)
  const [templateForm, setTemplateForm] = useState({
    subject: '',
    body: '',
    persona: '',
    stage: ''
  })
  const [campaignForm, setCampaignForm] = useState<CampaignFormData>({
    name: '',
    templateId: '',
    selectedLeads: [],
    emailInterval: 10, // 10 minutes default
    dailyLimit: 50,
    sendTimeStart: '07:00',
    sendTimeEnd: '09:00',
    timezone: 'America/New_York'
  })

  useEffect(() => {
    fetchData()
  }, [activeTab])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const [templatesData, campaignsData, leadsResponse] = await Promise.all([
        apiClient.getEmailTemplates(),
        apiClient.getEmailCampaigns(),
        apiClient.getLeads({ limit: 100 })
      ])

      if (templatesData.status === 'success') {
        setTemplates(templatesData.data || [])
      }
      if (campaignsData.status === 'success') {
        setCampaigns(campaignsData.data || [])
      }
      
      // Handle the leads response structure
      const leadsData = leadsResponse.data
      if (leadsData.status === 'success') {
        const leads = leadsData.leads || leadsData.data || []
        setLeads(leads)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Error loading data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return

    try {
      const data = await apiClient.deleteEmailTemplate(templateId)
      if (data.status === 'success') {
        toast.success('Template deleted successfully')
        fetchData()
      } else {
        toast.error(data.message || 'Failed to delete template')
      }
    } catch (error) {
      console.error('Error deleting template:', error)
      toast.error('Error deleting template')
    }
  }

  const handleCreateTemplate = async () => {
    if (!templateForm.subject || !templateForm.body || !templateForm.persona || !templateForm.stage) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      const data = await apiClient.createEmailTemplate({
        name: templateForm.subject,
        subject: templateForm.subject,
        body: templateForm.body,
        persona: templateForm.persona,
        stage: templateForm.stage,
        type: `${templateForm.persona}_${templateForm.stage}`,
        variables: []
      })
      
      if (data.status === 'success') {
        toast.success('Template created successfully')
        setTemplateForm({ subject: '', body: '', persona: '', stage: '' })
        setShowCreateTemplate(false)
        fetchData()
      } else {
        toast.error(data.message || 'Failed to create template')
      }
    } catch (error) {
      console.error('Error creating template:', error)
      toast.error('Error creating template')
    }
  }

  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template)
    setTemplateForm({
      subject: template.subject,
      body: template.body,
      persona: template.persona,
      stage: template.stage
    })
    setShowEditTemplate(true)
  }

  const handleUpdateTemplate = async () => {
    if (!editingTemplate || !templateForm.subject || !templateForm.body || !templateForm.persona || !templateForm.stage) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      const data = await apiClient.updateEmailTemplate(editingTemplate.id, {
        subject: templateForm.subject,
        body: templateForm.body,
        persona: templateForm.persona,
        stage: templateForm.stage
      })
      
      if (data.status === 'success') {
        toast.success('Template updated successfully')
        setTemplateForm({ subject: '', body: '', persona: '', stage: '' })
        setShowEditTemplate(false)
        setEditingTemplate(null)
        fetchData()
      } else {
        toast.error(data.message || 'Failed to update template')
      }
    } catch (error) {
      console.error('Error updating template:', error)
      toast.error('Error updating template')
    }
  }

  const handleLeadSelection = (leadId: string) => {
    setSelectedLeads(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    )
  }

  const handleSelectAllLeads = () => {
    const filteredLeadIds = filteredLeads.map(lead => lead.id)
    setSelectedLeads(prev => 
      prev.length === filteredLeadIds.length 
        ? []
        : filteredLeadIds
    )
  }

  const handleCreateCampaign = async () => {
    if (!campaignForm.name || !campaignForm.templateId || selectedLeads.length === 0) {
      toast.error('Please fill in all required fields and select leads')
      return
    }

    try {
      const campaignData = {
        ...campaignForm,
        selectedLeads
      }

      const response = await apiClient.createEmailCampaign(campaignData)
      if (response.status === 'success') {
        toast.success('Campaign created successfully!')
        setShowCreateCampaign(false)
        setSelectedLeads([])
        setCampaignForm({
          name: '',
          templateId: '',
          selectedLeads: [],
          emailInterval: 10,
          dailyLimit: 50,
          sendTimeStart: '07:00',
          sendTimeEnd: '09:00',
          timezone: 'America/New_York'
        })
        fetchData()
      } else {
        toast.error(response.message || 'Failed to create campaign')
      }
    } catch (error) {
      console.error('Error creating campaign:', error)
      toast.error('Error creating campaign')
    }
  }

  const handleCampaignAction = async (campaignId: string, action: 'start' | 'pause' | 'resume') => {
    try {
      const response = await apiClient.updateCampaignStatus(campaignId, action)
      if (response.status === 'success') {
        toast.success(`Campaign ${action}ed successfully`)
        fetchData()
      } else {
        toast.error(response.message || `Failed to ${action} campaign`)
      }
    } catch (error) {
      console.error(`Error ${action}ing campaign:`, error)
      toast.error(`Error ${action}ing campaign`)
    }
  }

  const handleDeleteCampaign = async () => {
    if (!deletingCampaignId) return
    
    try {
      const response = await apiClient.deleteCampaign(deletingCampaignId)
      if (response.status === 'success') {
        toast.success('Campaign deleted successfully')
        fetchData()
      } else {
        toast.error(response.message || 'Failed to delete campaign')
      }
    } catch (error) {
      console.error('Error deleting campaign:', error)
      toast.error('Error deleting campaign')
    } finally {
      setShowDeleteConfirm(false)
      setDeletingCampaignId(null)
    }
  }

  const confirmDeleteCampaign = (campaignId: string) => {
    setDeletingCampaignId(campaignId)
    setShowDeleteConfirm(true)
  }



  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.body.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesPersona = !filterPersona || template.persona === filterPersona
    const matchesStage = !filterStage || template.stage === filterStage
    return matchesSearch && matchesPersona && matchesStage
  })

  const filteredCampaigns = campaigns.filter(campaign =>
    campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    campaign.templateSubject.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lead.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lead.job_title.toLowerCase().includes(searchTerm.toLowerCase())
    // Check for email availability - either email or email_address field should exist
    const hasEmail = (lead.email || lead.email_address)
    return matchesSearch && hasEmail
  })

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      draft: 'bg-gray-100 text-gray-800',
      active: 'bg-green-100 text-green-800',
      paused: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-blue-100 text-blue-800'
    }
    return statusClasses[status as keyof typeof statusClasses] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            📧 Email Campaign Management
          </h1>
          <p className="text-gray-600">
            Create and manage AI-powered email campaigns with smart scheduling
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'campaigns', label: 'Campaigns', icon: Send },
                { id: 'templates', label: 'Templates', icon: Mail },
                { id: 'create-campaign', label: 'Create Campaign', icon: Plus }
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as any)}
                  className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          {activeTab === 'templates' && (
            <>
              <select
                value={filterPersona}
                onChange={(e) => setFilterPersona(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-48"
              >
                <option value="">All Personas</option>
                <option value="operations_manager">Operations Manager</option>
                <option value="facility_manager">Facility Manager</option>
                <option value="maintenance_manager">Maintenance Manager</option>
                <option value="plant_manager">Plant Manager</option>
              </select>
              
              <select
                value={filterStage}
                onChange={(e) => setFilterStage(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-48"
              >
                <option value="">All Stages</option>
                <option value="initial_outreach">Initial Outreach</option>
                <option value="follow_up">Follow Up</option>
                <option value="meeting_request">Meeting Request</option>
              </select>
              
              <button
                onClick={() => setShowCreateTemplate(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Create Template
              </button>
            </>
          )}
        </div>

        {/* Create Template Modal */}
        {showCreateTemplate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Create Email Template</h2>
                <button
                  onClick={() => setShowCreateTemplate(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Persona *
                    </label>
                    <input
                      type="text"
                      value={templateForm.persona}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, persona: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter target persona (e.g., Operations Manager, CEO, etc.)"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Stage *
                    </label>
                    <select
                      value={templateForm.stage}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, stage: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select stage</option>
                      <option value="initial_outreach">Initial Outreach</option>
                      <option value="follow_up">Follow Up</option>
                      <option value="meeting_request">Meeting Request</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subject Line *
                  </label>
                  <input
                    type="text"
                    value={templateForm.subject}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, subject: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter email subject line"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Body *
                  </label>
                  <textarea
                    value={templateForm.body}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, body: e.target.value }))}
                    rows={8}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter email body content..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                     You can use variables like {'{firstName}'}, {'{companyName}'}, {'{jobTitle}'} for personalization
                   </p>
                </div>
              </div>
              
              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCreateTemplate(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTemplate}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Create Template
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Template Modal */}
        {showEditTemplate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Edit Email Template</h2>
                <button
                  onClick={() => {
                    setShowEditTemplate(false)
                    setEditingTemplate(null)
                    setTemplateForm({ subject: '', body: '', persona: '', stage: '' })
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Persona *
                    </label>
                    <input
                      type="text"
                      value={templateForm.persona}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, persona: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter target persona (e.g., Operations Manager, CEO, etc.)"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Stage *
                    </label>
                    <select
                      value={templateForm.stage}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, stage: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select stage</option>
                      <option value="initial_outreach">Initial Outreach</option>
                      <option value="follow_up">Follow Up</option>
                      <option value="meeting_request">Meeting Request</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subject Line *
                  </label>
                  <input
                    type="text"
                    value={templateForm.subject}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, subject: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter email subject line"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Body *
                  </label>
                  <textarea
                    value={templateForm.body}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, body: e.target.value }))}
                    rows={8}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter email body content..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                     You can use variables like {'{firstName}'}, {'{companyName}'}, {'{jobTitle}'} for personalization
                   </p>
                </div>
              </div>
              
              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowEditTemplate(false)
                    setEditingTemplate(null)
                    setTemplateForm({ subject: '', body: '', persona: '', stage: '' })
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateTemplate}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Update Template
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Campaigns Tab */}
            {activeTab === 'campaigns' && (
              <div className="grid gap-6">
                {filteredCampaigns.length === 0 ? (
                  <div className="text-center py-12">
                    <Send className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No campaigns found</h3>
                    <p className="text-gray-600">Create your first email campaign to get started</p>
                  </div>
                ) : (
                  filteredCampaigns.map((campaign) => (
                    <div key={campaign.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {campaign.name}
                            </h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(campaign.status)}`}>
                              {campaign.status}
                            </span>
                          </div>
                          <p className="text-gray-600 mb-4">
                            Template: {campaign.templateSubject}
                          </p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                            <div>
                              <span className="text-gray-500">Total Leads:</span>
                              <span className="ml-2 font-medium">{campaign.totalLeads}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Sent:</span>
                              <span className="ml-2 font-medium">{campaign.sentCount}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Scheduled:</span>
                              <span className="ml-2 font-medium">{campaign.scheduledCount}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Open Rate:</span>
                              <span className="ml-2 font-medium">{campaign.openRate}%</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {campaign.sendTimeStart} - {campaign.sendTimeEnd}
                            </span>
                            <span>Interval: {campaign.emailInterval}m</span>
                            <span>Daily Limit: {campaign.dailyLimit}</span>
                            {campaign.nextSendTime && (
                              <span>Next: {new Date(campaign.nextSendTime).toLocaleString()}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {campaign.status === 'draft' && (
                            <button
                              onClick={() => handleCampaignAction(campaign.id, 'start')}
                              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                            >
                              <Play className="h-4 w-4" />
                              Start
                            </button>
                          )}
                          {campaign.status === 'active' && (
                            <button
                              onClick={() => handleCampaignAction(campaign.id, 'pause')}
                              className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                            >
                              <Pause className="h-4 w-4" />
                              Pause
                            </button>
                          )}
                          {campaign.status === 'paused' && (
                            <button
                              onClick={() => handleCampaignAction(campaign.id, 'resume')}
                              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                            >
                              <Play className="h-4 w-4" />
                              Resume
                            </button>
                          )}
                          <button
                            onClick={() => confirmDeleteCampaign(campaign.id)}
                            className="text-gray-400 hover:text-red-500 p-1 rounded transition-colors"
                            title="Delete campaign"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Templates Tab */}
            {activeTab === 'templates' && (
              <div className="grid gap-6">
                {filteredTemplates.length === 0 ? (
                  <div className="text-center py-12">
                    <Mail className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
                    <p className="text-gray-600">Create your first email template to get started</p>
                  </div>
                ) : (
                  filteredTemplates.map((template) => (
                    <div key={template.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            {template.subject}
                          </h3>
                          <p className="text-gray-600 mb-4 line-clamp-3">
                            {template.body.substring(0, 200)}...
                          </p>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span className="capitalize">{template.persona.replace('_', ' ')}</span>
                            <span className="capitalize">{template.stage.replace('_', ' ')}</span>
                            <span>Used {template.usageCount} times</span>
                            <span>{new Date(template.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button 
                            onClick={() => handleEditTemplate(template)}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded-lg"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="bg-red-100 hover:bg-red-200 text-red-700 p-2 rounded-lg"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Create Campaign Tab */}
            {activeTab === 'create-campaign' && (
              <div className="space-y-6">
                {/* Campaign Settings */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Campaign Settings</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Campaign Name *
                      </label>
                      <input
                        type="text"
                        value={campaignForm.name}
                        onChange={(e) => setCampaignForm(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter campaign name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Template *
                      </label>
                      <select
                        value={campaignForm.templateId}
                        onChange={(e) => setCampaignForm(prev => ({ ...prev, templateId: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select a template</option>
                        {templates.map(template => (
                          <option key={template.id} value={template.id}>
                            {template.subject}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Interval (minutes)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="1"
                          max="1440"
                          value={campaignForm.emailInterval}
                          onChange={(e) => setCampaignForm(prev => ({ ...prev, emailInterval: parseInt(e.target.value) }))}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const recommended = calculateRecommendedInterval(campaignForm.dailyLimit, campaignForm.sendTimeStart, campaignForm.sendTimeEnd, selectedLeads.length)
                            setCampaignForm(prev => ({ ...prev, emailInterval: recommended }))
                          }}
                          className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                        >
                          Auto
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Recommended: {calculateRecommendedInterval(campaignForm.dailyLimit, campaignForm.sendTimeStart, campaignForm.sendTimeEnd, selectedLeads.length)} minutes
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Daily Email Limit
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="200"
                        value={campaignForm.dailyLimit}
                        onChange={(e) => setCampaignForm(prev => ({ ...prev, dailyLimit: parseInt(e.target.value) }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Send Time Start
                      </label>
                      <input
                        type="time"
                        value={campaignForm.sendTimeStart}
                        onChange={(e) => setCampaignForm(prev => ({ ...prev, sendTimeStart: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Send Time End
                      </label>
                      <input
                        type="time"
                        value={campaignForm.sendTimeEnd}
                        onChange={(e) => setCampaignForm(prev => ({ ...prev, sendTimeEnd: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* Lead Selection */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-900">Select Leads</h2>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-600">
                        {selectedLeads.length} of {filteredLeads.length} selected
                      </span>
                      <button
                        onClick={handleSelectAllLeads}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        {selectedLeads.length === filteredLeads.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                  </div>
                  
                  <div className="max-h-96 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Select
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Job Title
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Company
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            ICP Score
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredLeads.map((lead) => (
                          <tr
                            key={lead.id}
                            className={`cursor-pointer hover:bg-gray-50 ${
                              selectedLeads.includes(lead.id) ? 'bg-blue-50' : ''
                            }`}
                            onClick={() => handleLeadSelection(lead.id)}
                          >
                            <td className="px-3 py-4 whitespace-nowrap">
                              {selectedLeads.includes(lead.id) ? (
                                <CheckSquare className="h-5 w-5 text-blue-600" />
                              ) : (
                                <Square className="h-5 w-5 text-gray-400" />
                              )}
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{lead.full_name}</div>
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{lead.job_title}</div>
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{lead.company_name}</div>
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{lead.email || lead.email_address}</div>
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-1 text-sm text-gray-900">
                                <Target className="h-3 w-3" />
                                {lead.icp_score}%
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Create Campaign Button */}
                <div className="flex justify-end">
                  <button
                    onClick={handleCreateCampaign}
                    disabled={!campaignForm.name || !campaignForm.templateId || selectedLeads.length === 0}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2"
                  >
                    <Plus className="h-5 w-5" />
                    Create Campaign
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">Delete Campaign</h3>
                <p className="text-sm text-gray-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete this campaign? All scheduled emails and campaign data will be permanently removed.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeletingCampaignId(null)
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCampaign}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                Delete Campaign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
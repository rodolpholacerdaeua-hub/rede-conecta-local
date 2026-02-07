/**
 * useCampaignData — Custom hook for campaign state management & data loading
 */
import { useState, useEffect } from 'react';
import { supabase } from '../../supabase';

export function useCampaignData(currentUser, userData) {
    const [campaigns, setCampaigns] = useState([]);
    const [mediaFiles, setMediaFiles] = useState([]);
    const [terminals, setTerminals] = useState([]);
    const [businessCategories, setBusinessCategories] = useState([]);

    // Form states
    const [isAdding, setIsAdding] = useState(false);
    const [isAIGenerating, setIsAIGenerating] = useState(false);
    const [previewPhotos, setPreviewPhotos] = useState([]);
    const [uploadingFiles, setUploadingFiles] = useState([]);
    const [refiningCamp, setRefiningCamp] = useState(null);
    const [refinementText, setRefinementText] = useState('');
    const [previewCamp, setPreviewCamp] = useState(null);

    const [newName, setNewName] = useState('');
    const [hMediaId, setHMediaId] = useState('');
    const [vMediaId, setVMediaId] = useState('');
    const [screensQuota, setScreensQuota] = useState(1);
    const [targetTerminals, setTargetTerminals] = useState([]);
    const selectedOrientation = 'portrait';

    const [aiText, setAiText] = useState('');
    const [aiPhotos, setAiPhotos] = useState([]);
    const [isSubmittingAI, setIsSubmittingAI] = useState(false);
    const [isGlobal, setIsGlobal] = useState(false);
    const [rejectionModalCamp, setRejectionModalCamp] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [editingCamp, setEditingCamp] = useState(null);
    const [slotsCount, setSlotsCount] = useState(1);

    // Approval modal states
    const [approvalModalCamp, setApprovalModalCamp] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [categoryConflicts, setCategoryConflicts] = useState([]);

    useEffect(() => {
        if (!currentUser) return;
        let isMounted = true;

        const loadData = async () => {
            try {
                let campaignsQuery = supabase.from('campaigns').select('*').order('created_at', { ascending: false });
                if (userData?.role !== 'admin') {
                    campaignsQuery = campaignsQuery.eq('owner_id', currentUser.id);
                }
                const { data: campaignsData } = await campaignsQuery;
                if (isMounted) setCampaigns(campaignsData || []);

                let mediaQuery = supabase.from('media').select('*')
                    .neq('status', 'deleted')
                    .order('created_at', { ascending: false });
                if (userData?.role !== 'admin') {
                    mediaQuery = mediaQuery.eq('owner_id', currentUser.id);
                }
                const { data: mediaData } = await mediaQuery;
                if (isMounted) setMediaFiles(mediaData || []);

                const { data: terminalsData } = await supabase.from('terminals').select('*').order('name');
                if (isMounted) setTerminals(terminalsData || []);

                const { data: categoriesData } = await supabase.from('business_categories').select('*').order('name');
                if (isMounted) setBusinessCategories(categoriesData || []);
            } catch (e) {
                console.error('Campaigns load error:', e);
            }
        };

        loadData();

        // Realtime subscription
        let debounceTimeout = null;
        const channel = supabase
            .channel('campaigns-realtime')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'campaigns'
            }, (payload) => {
                console.log('[Realtime] 📡 Campanha alterada:', payload.eventType, payload.new?.name || payload.old?.id);
                if (debounceTimeout) clearTimeout(debounceTimeout);
                debounceTimeout = setTimeout(() => {
                    console.log('[Realtime] 🔄 Recarregando campanhas...');
                    loadData();
                }, 500);
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[Realtime] ✅ Conectado ao canal campaigns');
                } else {
                    console.log('[Realtime] Status:', status);
                }
            });

        return () => {
            isMounted = false;
            supabase.removeChannel(channel);
        };
    }, [currentUser?.id, userData?.role]);

    const resetForm = () => {
        setNewName('');
        setHMediaId('');
        setVMediaId('');
        setTargetTerminals([]);
        setIsGlobal(false);
        setSlotsCount(1);
        setIsAdding(false);
        setEditingCamp(null);
    };

    const handleToggleTerminal = (id) => {
        setTargetTerminals(prev =>
            prev.includes(id)
                ? prev.filter(tid => tid !== id)
                : [...prev, id]
        );
    };

    const handlePhotoSelect = (e) => {
        const files = Array.from(e.target.files);
        setUploadingFiles(prev => [...prev, ...files]);
        const newPreviews = files.map(file => URL.createObjectURL(file));
        setPreviewPhotos(prev => [...prev, ...newPreviews]);
    };

    return {
        // Data
        campaigns, setCampaigns,
        mediaFiles,
        terminals,
        businessCategories,

        // Form states
        isAdding, setIsAdding,
        isAIGenerating, setIsAIGenerating,
        previewPhotos, setPreviewPhotos,
        uploadingFiles, setUploadingFiles,
        refiningCamp, setRefiningCamp,
        refinementText, setRefinementText,
        previewCamp, setPreviewCamp,

        // Campaign form fields
        newName, setNewName,
        hMediaId, setHMediaId,
        vMediaId, setVMediaId,
        screensQuota, setScreensQuota,
        targetTerminals, setTargetTerminals,
        selectedOrientation,

        // AI fields
        aiText, setAiText,
        aiPhotos, setAiPhotos,
        isSubmittingAI, setIsSubmittingAI,

        // Toggle / global
        isGlobal, setIsGlobal,
        editingCamp, setEditingCamp,
        slotsCount, setSlotsCount,

        // Moderation
        rejectionModalCamp, setRejectionModalCamp,
        rejectionReason, setRejectionReason,
        approvalModalCamp, setApprovalModalCamp,
        selectedCategory, setSelectedCategory,
        categoryConflicts, setCategoryConflicts,

        // Actions
        resetForm,
        handleToggleTerminal,
        handlePhotoSelect,
    };
}

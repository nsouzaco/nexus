import { createClient } from '@/lib/supabase/server';

interface SlideContent {
  title: string;
  body?: string;
}

interface CreatePresentationResult {
  id: string;
  url: string;
  slideCount: number;
}

/**
 * Get Google access token for a user (reusing the same token as Drive)
 */
async function getGoogleToken(userId: string): Promise<string | null> {
  const supabase = await createClient();
  
  const { data: integration } = await supabase
    .from('integrations')
    .select('access_token, status')
    .eq('user_id', userId)
    .eq('provider', 'google_drive')
    .eq('status', 'active')
    .single();

  if (!integration?.access_token) {
    return null;
  }

  return integration.access_token;
}

/**
 * Create a new Google Slides presentation with slides
 */
export async function createPresentation(
  userId: string,
  title: string,
  slides: SlideContent[]
): Promise<CreatePresentationResult | { error: string }> {
  const accessToken = await getGoogleToken(userId);
  
  if (!accessToken) {
    return { error: 'Google Drive is not connected or token expired. Please reconnect from the Dashboard.' };
  }

  try {
    // Step 1: Create an empty presentation
    const createResponse = await fetch('https://slides.googleapis.com/v1/presentations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: title,
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('Failed to create presentation:', createResponse.status, errorText);
      return { error: `Failed to create presentation: ${createResponse.status}` };
    }

    const presentation = await createResponse.json();
    const presentationId = presentation.presentationId;

    // The presentation comes with a default blank slide, get its ID
    const defaultSlideId = presentation.slides?.[0]?.objectId;

    // Step 2: Build batch update requests to add slides
    const requests: any[] = [];

    // Add title and body to the first slide (default slide)
    if (slides.length > 0 && defaultSlideId) {
      const firstSlide = slides[0];
      
      // Find the title and body placeholders on the default slide
      const titlePlaceholder = presentation.slides?.[0]?.pageElements?.find(
        (el: any) => el.shape?.placeholder?.type === 'CENTERED_TITLE' || el.shape?.placeholder?.type === 'TITLE'
      );
      const bodyPlaceholder = presentation.slides?.[0]?.pageElements?.find(
        (el: any) => el.shape?.placeholder?.type === 'BODY' || el.shape?.placeholder?.type === 'SUBTITLE'
      );

      if (titlePlaceholder) {
        requests.push({
          insertText: {
            objectId: titlePlaceholder.objectId,
            text: firstSlide.title,
            insertionIndex: 0,
          },
        });
      }

      if (bodyPlaceholder && firstSlide.body) {
        requests.push({
          insertText: {
            objectId: bodyPlaceholder.objectId,
            text: firstSlide.body,
            insertionIndex: 0,
          },
        });
      }
    }

    // Add additional slides
    for (let i = 1; i < slides.length; i++) {
      const slide = slides[i];
      const slideId = `slide_${i}_${Date.now()}`;
      const titleId = `title_${i}_${Date.now()}`;
      const bodyId = `body_${i}_${Date.now()}`;

      // Create a new slide with TITLE_AND_BODY layout
      requests.push({
        createSlide: {
          objectId: slideId,
          insertionIndex: i,
          slideLayoutReference: {
            predefinedLayout: 'TITLE_AND_BODY',
          },
          placeholderIdMappings: [
            {
              layoutPlaceholder: { type: 'TITLE' },
              objectId: titleId,
            },
            {
              layoutPlaceholder: { type: 'BODY' },
              objectId: bodyId,
            },
          ],
        },
      });

      // Add title text
      requests.push({
        insertText: {
          objectId: titleId,
          text: slide.title,
          insertionIndex: 0,
        },
      });

      // Add body text if provided
      if (slide.body) {
        requests.push({
          insertText: {
            objectId: bodyId,
            text: slide.body,
            insertionIndex: 0,
          },
        });
      }
    }

    // Step 3: Execute batch update if we have requests
    if (requests.length > 0) {
      const batchResponse = await fetch(
        `https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ requests }),
        }
      );

      if (!batchResponse.ok) {
        const errorText = await batchResponse.text();
        console.error('Failed to update presentation:', batchResponse.status, errorText);
        // Still return the presentation even if content update failed
        return {
          id: presentationId,
          url: `https://docs.google.com/presentation/d/${presentationId}`,
          slideCount: 1,
        };
      }
    }

    return {
      id: presentationId,
      url: `https://docs.google.com/presentation/d/${presentationId}`,
      slideCount: slides.length || 1,
    };
  } catch (error) {
    console.error('Error creating presentation:', error);
    return { error: `Failed to create presentation: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

/**
 * Check if user has Google connected with Slides permissions
 */
export async function hasGoogleSlidesConnected(userId: string): Promise<boolean> {
  const supabase = await createClient();
  
  const { data: integration } = await supabase
    .from('integrations')
    .select('status')
    .eq('user_id', userId)
    .eq('provider', 'google_drive')
    .eq('status', 'active')
    .single();

  return integration !== null;
}


import React from 'react';
import { Alert, Linking, Platform, Pressable, Text } from 'react-native';
import DocumentPicker, { DocumentPickerResponse } from 'react-native-document-picker';
import { Asset, launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { PERMISSIONS, request, RESULTS } from 'react-native-permissions';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDispatch } from '@/hooks';
import { updateAttachments } from '@/store/conversation/sendMessageSlice';
import { useRefsContext } from '@/context';
import { AttachFileIcon, CameraIcon, PhotosIcon, UnassignedIcon  } from '@/svg-icons';
import { tailwind } from '@/theme';
import { useHaptic, useScaleAnimation } from '@/utils';
import { Icon } from '@/components-next/common';
import { MAXIMUM_FILE_UPLOAD_SIZE } from '@/constants';
import i18n from '@/i18n';
import { showToast } from '@/helpers/ToastHelper';
import { findFileSize } from '@/helpers/FileHelper';
import axios from 'axios';
import { getHeaders, getBaseUrl, getUser } from '../../../../services/auth';

export const handleOpenPhotosLibrary = async dispatch => {
  if (Platform.OS === 'ios') {
    request(
      Platform.OS === 'ios'
        ? PERMISSIONS.IOS.PHOTO_LIBRARY
        : PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE,
    ).then(async result => {
      if (RESULTS.BLOCKED === result) {
        Alert.alert(
          'Permission Denied',
          'The permission to access the photo library has been denied and cannot be requested again. Please enable it in your device settings if you wish to access photos from your library.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Open Settings',
              onPress: () => {
                // Open app settings
                Linking.openSettings();
              },
            },
          ],
          { cancelable: false },
        );
      }
      if (result === RESULTS.GRANTED || result === RESULTS.LIMITED) {
        const pickedAssets = await launchImageLibrary({
          quality: 1,
          selectionLimit: 4,
          mediaType: 'mixed',
          presentationStyle: 'formSheet',
        });
        if (pickedAssets.didCancel) {
        } else if (pickedAssets.errorCode) {
        } else {
          if (pickedAssets.assets && pickedAssets.assets?.length > 0) {
            validateFileAndSetAttachments(dispatch, pickedAssets.assets[0]);
          }
        }
      }
    });
  } else {
    request(PERMISSIONS.ANDROID.ACCESS_MEDIA_LOCATION).then(async result => {
      if (RESULTS.BLOCKED === result) {
        Alert.alert(
          'Permission Denied',
          'The permission to access the photo library has been denied and cannot be requested again. Please enable it in your device settings if you wish to access photos from your library.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Open Settings',
              onPress: () => {
                // Open app settings
                Linking.openSettings();
              },
            },
          ],
          { cancelable: false },
        );
      }
      if (result === RESULTS.GRANTED) {
        const pickedAssets = await launchImageLibrary({
          quality: 1,
          selectionLimit: 4,
          mediaType: 'mixed',
          presentationStyle: 'formSheet',
        });
        if (pickedAssets.didCancel) {
        } else if (pickedAssets.errorCode) {
        } else {
          if (pickedAssets.assets && pickedAssets.assets?.length > 0) {
            validateFileAndSetAttachments(dispatch, pickedAssets.assets[0]);
          }
        }
      }
    });
  }
};

const handleLaunchCamera = async dispatch => {
  request(Platform.OS === 'ios' ? PERMISSIONS.IOS.CAMERA : PERMISSIONS.ANDROID.CAMERA).then(
    async result => {
      if (RESULTS.BLOCKED === result) {
        Alert.alert(
          'Permission Denied',
          'The permission to access the camera has been denied and cannot be requested again. Please enable it in your device settings if you wish to use the camera feature.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Open Settings',
              onPress: () => {
                // Open app settings
                Linking.openSettings();
              },
            },
          ],
          { cancelable: false },
        );
      }
      if (RESULTS.GRANTED === result) {
        const imageResult = await launchCamera({
          presentationStyle: 'formSheet',
          mediaType: 'mixed',
        });
        if (imageResult.didCancel) {
        } else if (imageResult.errorCode) {
        } else {
          if (imageResult.assets && imageResult.assets?.length > 0) {
            validateFileAndSetAttachments(dispatch, imageResult.assets[0]);
          }
        }
      }
    },
  );
};

/**
 * Doing this so that the our Store Object Attachments is of single type - Asset from Image Picker Library
 * The function `mapObject` takes an object of type `DocumentPickerResponse` and returns an array of
 * `Asset` objects with properties `fileName`, `fileSize`, `type`, and `uri`.
 * @param {DocumentPickerResponse} originalObject - The originalObject parameter is of type
 * DocumentPickerResponse.
 * @returns The function `mapObject` is returning an array of `Asset` objects.
 */
const mapObject = (originalObject: DocumentPickerResponse): Asset[] => {
  return [
    {
      fileName: originalObject.name || '',
      fileSize: originalObject.size || 0,
      type: originalObject.type || '',
      uri: originalObject.uri || '',
    },
  ];
};

const handleAttachFile = async dispatch => {
  try {
    const result = await DocumentPicker.pick({
      type: [
        DocumentPicker.types.allFiles,
        DocumentPicker.types.images,
        DocumentPicker.types.plainText,
        DocumentPicker.types.audio,
        DocumentPicker.types.pdf,
        DocumentPicker.types.zip,
        DocumentPicker.types.csv,
        DocumentPicker.types.doc,
        DocumentPicker.types.docx,
        DocumentPicker.types.ppt,
        DocumentPicker.types.pptx,
        DocumentPicker.types.xls,
        DocumentPicker.types.xlsx,
      ], // You can specify the file types you want to allow
      presentationStyle: 'formSheet',
    });
    validateFileAndSetAttachments(dispatch, mapObject(result[0]));
  } catch (err) {
    if (DocumentPicker.isCancel(err)) {
      // User cancelled the picker
    } else {
      throw err;
    }
  }
};


const handleStartConversation = async (dispatch, senderId: number, contact: ContactUser ,inboxId: number) => {
   //const headers = await getHeaders();
   const baseurl = await getBaseUrl();
   const user = await getUser();
    if (!user || !baseurl) return;

    const API_ENDPOINT = `${baseurl}api/v1/accounts/${user.account_id}/conversations`;
    console.log('inboxId',inboxId);

 
  try {
    const requestBody = {
      inbox_id: inboxId, 
      contact_id: contact?.id, 
      source_id: contact?.phoneNumber?.replace('+', ''),
      message: {
        content:
          'Mensaje de inicio de conversación',
        template_params: {
          name: 'hello_world',
          category: 'UTILITY',
          language: 'en_US',
          processed_params: {},
        },
      },
      assignee_id: senderId,
    };

    const headers = {
      api_access_token: user.access_token,
      'Content-Type': 'application/json',
    };


    const response = await axios.post(API_ENDPOINT, requestBody, { headers });

    //console.log('Respuesta exitosa de la API:', response.data);

  } catch (error) { {
      console.error('Error al realizar la petición:', error);

      if (axios.isAxiosError(error)) {
        console.error('Detalles del error de la API:', error.response?.data);
        Alert.alert(
          'Error de API',
          `Hubo un problema al iniciar la conversación: ${error.response?.data?.message || error.message}`
        );
      } else {
        Alert.alert('Error', 'No se pudo iniciar la conversación. Revisa la conexión y vuelve a intentarlo.');
      }
    }
   }
};

const ADD_MENU_OPTIONS : MenuOptionItem[] = [
  {
    icon: <PhotosIcon />,
    title: 'Photos',
    handlePress: handleOpenPhotosLibrary,
  },
  {
    icon: <CameraIcon />,
    title: 'Camera',
    handlePress: handleLaunchCamera,
  },
  {
    icon: <AttachFileIcon />,
    title: 'Attach File',
    handlePress: handleAttachFile,
  },
  /*
   {
    icon: <PhotosIcon />,
    title: 'Iniciar Conversación',
    handlePress: handleStartConversation,
  },*/
  
];
  

export const validateFileAndSetAttachments = async (dispatch, attachment) => {
  const { fileSize } = attachment;
  if (findFileSize(fileSize) <= MAXIMUM_FILE_UPLOAD_SIZE) {
    dispatch(updateAttachments([attachment]));
  } else {
    showToast({ message: i18n.t('CONVERSATION.FILE_SIZE_LIMIT') });
  }
};

type MenuOptionProps = {
  index: number;
  menuOption: MenuOptionItem
  senderId: number
  conversationContact: ContactUser;
  inboxId: number; 
};

const MenuOption = (props: MenuOptionProps) => {
  const { index, menuOption, senderId,conversationContact,  inboxId} = props;
  const dispatch = useAppDispatch();
  const { macrosListSheetRef } = useRefsContext();

  const { animatedStyle, handlers } = useScaleAnimation();
  const hapticSelection = useHaptic();

  const handlePress = () => {
    hapticSelection?.();
    menuOption?.handlePress(dispatch, senderId, conversationContact, inboxId  );
    if (menuOption.title === 'Macros') {
      macrosListSheetRef.current?.present();
    }
  };
  
  
  return (
    <Animated.View style={[tailwind.style('mb-3'), animatedStyle]}>
      <Pressable onPress={handlePress} {...handlers}>
        <Animated.View key={index} style={[tailwind.style('flex-row items-center justify-start')]}>
          <Animated.View style={tailwind.style('p-2')}>
            <Icon icon={menuOption.icon} size={24} />
          </Animated.View>
          <Text
            style={tailwind.style(
              'text-base font-inter-normal-20 leading-[18px] tracking-[0.24px] text-gray-950 pl-5',
            )}>
            {menuOption.title}
          </Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
};

type ContactUser = {
  id: number;
  phoneNumber?: string | null;
} | undefined;

type CommandOptionsMenuProps = {
  senderId: number
  conversationContact: ContactUser;
  inboxId: number;
  showStartConversationOption: boolean;
};

type MenuOptionItem = {
  icon: JSX.Element;
  title: string;
  handlePress: (
    dispatch: any,
    senderId: number,
    contact: ContactUser,
    inboxId: number
  ) => void | Promise<void>;
};

export const CommandOptionsMenu = ({ senderId, conversationContact, inboxId,showStartConversationOption   }: CommandOptionsMenuProps) => {
  const { bottom } = useSafeAreaInsets();
  const isAndroid = Platform.OS === 'android';
  const containerHeight = isAndroid
    ? 150 + (bottom === 0 ? 16 : bottom)
    : 110 + (bottom === 0 ? 16 : bottom);

  const optionsToShow: MenuOptionItem[] = [...ADD_MENU_OPTIONS];

  if (showStartConversationOption) {
    optionsToShow.push({
      icon: <UnassignedIcon  />,
      title: 'Start Conversation',
      handlePress: handleStartConversation,
    });
  }
  return (
    <Animated.View
      entering={SlideInDown.springify().damping(38).stiffness(240)}
      exiting={SlideOutDown.springify().damping(38).stiffness(240)}
      style={[
        tailwind.style('mx-1 pt-2 items-start'),
        { paddingBottom: bottom === 0 ? 16 : bottom }
      ]}>
      {optionsToShow.map((menuOption, index) => {
        return <MenuOption key={menuOption.title} {...{ menuOption, index, senderId,conversationContact,inboxId }} />;
      })}
    </Animated.View>
  );
};
